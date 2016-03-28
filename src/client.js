'use strict';

import soap from 'soap';
import {Response} from './response';

export class Client {

  constructor(testing=false) {
    this._testing = testing;
    const testingLoc = 'https://tbk.orangepeople.cl/webpayserver/wswebpay/OneClickPaymentService';
    const productionLoc = 'https://webpay3g.transbank.cl:443/webpayserver/wswebpay/OneClickPaymentService';
    this.location = testing ? testingLoc : productionLoc;
    this.client = this.createClient();
  }

  createClient(cb) {
    soap.createClient(this.location, cb);
  }

  request(action, xml) {
    try {
      return new Response(this.client[action](xml), action, true);
    } catch (err) {
      if (err.errno === 'ECONNRESET') {
        const responseError = Response('ECONNRESET', action);
        responseError.error = 'ECONNRESET';
        responseError.error_msg = '[Errno 104] Connection reset by peer';
        return responseError;
      } else {
        throw err;
      }
    }
  }
}
