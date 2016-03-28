'use strict';

export class Request {

  constructor(params) {
    this._params = params;
  }

  params() {
    return this._params;
  }
}
