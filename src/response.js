'use strict';

import xmlC14n from 'xml-c14n';
import {pki} from 'node-forge';
import xml2js from 'xml2js';

const RESPONSE_CODE = {
  Authorize: {
    '0': 'Aprobado.',
    '-1': 'La transacción ha sido rechazada.',
    '-2': 'La transacción ha sido rechazada, por favor intente nuevamente.',
    '-3': 'Ha ocurrido un error al hacer la transacción.',
    '-4': 'La transacción ha sido rechazada.',
    '-5': 'La transacción ha sido rechazada porque la tasa es inválida.',
    '-6': 'Ha alcanzado el límite de transacciones mensuales.',
    '-7': 'Ha alcanzado el límite de transacciones diarias.',
    '-8': 'La transacción ha sido rechazada, el rubro es inválido.',
    '-97': 'Ha alcanzado el máximo monto diario de pagos.',
    '-98': 'La transacción ha sido rechazada porque ha excedido el máximo monto de pago.',
    '-99': 'La transacción ha sido rechazada porque ha excedido la máxima cantidad de pagos diarias.'
  },
  default: {
    '0': 'Aprobado.',
    '-98': 'Ha ocurrido un error inesperado.'
  }
};

const VALID_RESPONSE_PARAMS = {
  Authorize: [
    'authorizationCode', 'creditCardType', 'last4CardDigits', 'responseCode', 'transactionId'
  ],
  initInscription: ['token', 'urlWebpay'],
  finishInscription: [
    'authCode', 'creditCardType', 'last4CardDigits', 'responseCode', 'tbkUser'
  ],
  'codeReverseOneClick': ['reverseCode', 'reversed'],
  'removeUser': ['removed']
};

export class Response {

  constructor(content, action, testing=false) {
    this.error = null;
    this._testing = testing;
    this.content = this._canonicalize(content);
    this.action = action;
    this.xmlResponse = this.buildXmlResponse(content);
    this.validate();
  }

  buildXmlResponse(xmlString, cb) {
    xml2js.parseString(xmlString, cb);
  }

  _canonicalize(xml, cb) {
    const c14n = xmlC14n();
    const canonicaliser = c14n.createCanonicaliser('http://www.w3.org/2001/10/xml-exc-c14n#');
    canonicaliser.canonicalise(xml, cb);
  }

  tbkKey() {
    if (!this._tbkKey) this._tbkKey = pki.publicKeyFromPem(process.env.TBK_PUBLIC_CRT);
    return this._tbkKey;
  }

  _signedInfo() {
    const namespaces = [
      '{http://schemas.xmlsoap.org/soap/envelope/}Header',
      '{http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd}Security',
      '{http://www.w3.org/2000/09/xmldsig#}Signature',
      '{http://www.w3.org/2000/09/xmldsig#}SignedInfo'
    ];
    let element = this.xmlResponse;
    for(let ns of namespaces) {
      let idx = Object.keys(element).indexOf(ns);
      element = element[idx][ns];
    }
    const builder = new xml2js.Builder();
    const signedInfo = builder.buildObject(element);
    return this._canonicalize(signedInfo);
  }

  _signatureValue() {
    const namespaces = [
      '{http://schemas.xmlsoap.org/soap/envelope/}Header',
      '{http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd}Security',
      '{http://www.w3.org/2000/09/xmldsig#}Signature',
      '{http://www.w3.org/2000/09/xmldsig#}SignatureValue'
    ];
    let element = this.xmlResponse;
    for(let ns of namespaces) {
      let idx = Object.keys(element).indexOf(ns);
      element = element[idx][ns];
    }
    return element;
  }

  _isValidSignature() {
    if (this._testing) {
      return true;
    } else if (!process.env.TBK_PUBLIC_CRT) {
      return true;
    }
    return this.tbkKey().verify(this._signedInfo(), this._signatureValue());
  }

  str2bool(boolString) {
    if (boolString.toLowerCase() === 'true') {
      return true;
    } else if (boolString.toLowerCase() === 'false') {
      return false;
    } else {
      throw new Error('TypeError');
    }
  }

  params() {
    if (!this._xmlResult) {
      const result = {};
      for (let e of this.xmlResponse.findall('.//return')) {
        let isAction = false;
        for (let children of e.getchildren()) {
          if (this.action === 'codeReverseOneClick') {
            isAction = true;
            try {
              result[children.tag] = this.str2bool(children.text);
            } catch (err) {
              result[children.tag] = children.text;
            }
          } else {
            result[children.tag] = children.text;
          }
        }
        if (!isAction) {
          if (this.action === 'removeUser') {
            result.removed = this.str2bool(e.text);
          }
        }
      }

      const obj = {};
      for (let p of VALID_RESPONSE_PARAMS[this.action]) {
        obj[p] = result.get(p);
        p['x'] = result.get(p);
      }
      this._xmlResult = obj;
    }
    return this._xmlResult;
  }

  xmlError() {
    this._xmlError = null;
    if (!this._xmlError && this.xmlResponse) {
      const faultcode = this.xmlResponse.findall('.//faultcode');
      const faultstring = this.xmlResponse.findall('.//faultstring');
      if (faultcode && faultstring) {
        this._xmlError = {
          faultcode: faultcode[0].text,
          faultstring: faultstring[0].text
        };
      }
    }
    return this._xmlError;
  }

  isValid() {
    if (this.error) return false;
    return true;
  }

  responseCode() {
    if (this.params() && this.params().indexOf('response_code') > -1) {
      return this.params().responseCode.toString();
    }
    return null;
  }

  responseCodeDisplay() {
    if (RESPONSE_CODE.indexOf(this.action) > -1 && RESPONSE_CODE[this.action].indexOf(this.responseCode()) > -1) {
      return RESPONSE_CODE[this.action][this.responseCode()];
    } else if (RESPONSE_CODE.default.indexOf(this.responseCode()) > -1) {
      return RESPONSE_CODE['default'][this.responseCode()];
    } else {
      return this.responseCode();
    }
  }

  validate() {
    if (!this.xmlResponse) {
      this.error = 'SoapServerError';
      this.errorMsg = 'invalid XML response';
      this.userErrorMsg = 'Error al realizar la operación';
      this.extra = {};
    } else if (this.xmlError()) {
      this.error = 'SoapServerError';
      this.errorMsg = this.xmlError().faultstring;
      this.userErrorMsg = 'Error al realizar la operación';
      this.extra = this.xmlError();
    } else if (!this._isValidSignature()) {
      this.error = 'SecurityError';
      this.errorMsg = 'invalid signature value';
      this.userErrorMsg = 'Error al realizar la operación';
      this.extra = this.xmlError();
    } else {
      if (['finishInscription', 'Authorize'].indexOf(this.action) > -1 && parseInt(this.responseCode(), 10) !== 0) {
        this.error = `${this.action}Error`;
        this.errorMsg = this.responseCodeDisplay();
        this.userErrorMsg = this.errorMsg;
        this.extra = {responseCode: this.responseCode()};
      } else if (this.action === 'removeUser' && !this.params().removed) {
        this.error = 'removeUserError';
        this.errorMsg = 'imposible eliminar la inscripción';
        this.userErrorMsg = this.errorMsg;
        this.extra = {removed: false};
      } else if (this.action === 'codeReverseOneClick' && !this.params().reversed) {
        this.error = 'codeReverseOneClickError';
        this.errorMsg = 'imposible revertir la compra';
        this.userErrorMsg = this.errorMsg;
        this.extra = {reversed: false};
      }
    }
  }
}
