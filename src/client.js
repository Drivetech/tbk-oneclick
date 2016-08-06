'use strict';

const soap = require('soap');
const Response = require('./response').Response;

const Client = class Client {

  constructor(testing) {
    this._testing = testing || false;
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
};

module.exports = {
  Client: Client
};
