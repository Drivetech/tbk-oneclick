'use strict';

const moment = require('moment');
const crypto = require('crypto');
const pki = require('node-forge').pki;

const Document = class Document {

  constructor(action, params) {
    this._action = action;
    this._params = params;
    this.doc = this.buildDoc();
  }

  key() {
    if (!this._key) this._key = process.env.TBK_COMMERCE_KEY;
    return this._key;
  }

  cert() {
    if (!this._cert) this._cert = process.env.TBK_COMMERCE_CRT;
    return this._cert;
  }

  x509() {
    if (!this._x509) this._x509 = pki.certificateFromPem(this.cert());
    return this._x509;
  }

  getIssuerName() {
    return this.x509().issuer.attributes.map(x => `${x.shortName}=${x.value}`).join(', ');
  }

  getSerialNumber() {
    return parseInt(this.x509().serialNumber, 16);
  }

  getDigestValue(xml) {
    const shasum = crypto.createHash('sha1');
    shasum.update(xml);
    return shasum.digest('base64');
  }

  obj2string(obj) {
    return `{${Object.keys(obj).map(x => `'${x}': '${obj[x]}'`).join(', ')}}`;
  }

  getBodyId() {
    const data = `${this._action}${this.obj2string(this._params)}${moment().format('YYYY-MM-DD HH:mm:ss ZZ')}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  rsaSign(xml) {
    const key = this.key().toString('ascii');
    const sign = crypto.createSign('RSA-SHA1');
    sign.update(xml);
    return sign.sign(key, 'base64');
  }

  buildParamsXml(params) {
    let paramsXml = '';
    for (let i of Object.keys(params)) {
      paramsXml += `<${i}>${params[i]}</${i}>`;
    }
    return paramsXml;
  }

  buildDoc() {
    const bodyId = this.getBodyId();

    // 1) build body
    const bodyParams = this.buildParamsXml(this._params);
    const body = `<SOAP-ENV:Body xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" wsu:Id="${bodyId}"><ns1:${this._action} xmlns:ns1="http://webservices.webpayserver.transbank.com/"><arg0>${bodyParams}</arg0></ns1:${this._action}></SOAP-ENV:Body>`;

    // 2) firm with body
    const digestValue = this.getDigestValue(body);

    // 3) assign
    const xmlToSign = `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></ds:CanonicalizationMethod><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></ds:SignatureMethod><ds:Reference URI="#${bodyId}"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></ds:Transform></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></ds:DigestMethod><ds:DigestValue>${digestValue}</ds:DigestValue></ds:Reference></ds:SignedInfo>`;
    const signatureValue = this.rsaSign(xmlToSign);

    // 4) build headers
    return `<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Header><wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" SOAP-ENV:mustUnderstand="1"><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></ds:CanonicalizationMethod><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></ds:SignatureMethod><ds:Reference URI="#${bodyId}"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></ds:Transform></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></ds:DigestMethod><ds:DigestValue>${digestValue}</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>${signatureValue}</ds:SignatureValue><ds:KeyInfo><wsse:SecurityTokenReference><ds:X509Data><ds:X509IssuerSerial><ds:X509IssuerName>${this.getIssuerName()}</ds:X509IssuerName><ds:X509SerialNumber>${this.getSerialNumber()}</ds:X509SerialNumber></ds:X509IssuerSerial></ds:X509Data></wsse:SecurityTokenReference></ds:KeyInfo></ds:Signature></wsse:Security></SOAP-ENV:Header><SOAP-ENV:Body xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" wsu:Id="${bodyId}"><ns1:${this._action} xmlns:ns1="http://webservices.webpayserver.transbank.com/"><arg0>${bodyParams}</arg0></ns1:${this._action}></SOAP-ENV:Body></SOAP-ENV:Envelope>`;
  }
};

module.exports = {
  Document: Document
};
