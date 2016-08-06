'use strict';

const Request = class Request {

  constructor(params) {
    this._params = params;
  }

  params() {
    return this._params;
  }
};

module.exports = {
  Request: Request
};
