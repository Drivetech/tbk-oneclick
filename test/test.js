'use strict';

const Document = require('../src/document').Document;
const expect = require('chai').expect;
const fs = require('fs');
const path = require('path');
const parseString = require('xml2js').parseString;

process.env.TBK_COMMERCE_KEY = fs.readFileSync(path.join(__dirname, 'keys', '597029124456.key'));
process.env.TBK_COMMERCE_CRT = fs.readFileSync(path.join(__dirname, 'keys', '597029124456.crt'));

describe('tbk', () => {
  it('should return some parmas', done => {
    const action = 'initInscription';
    const params = {username: 'lgatica', responseURL: 'https://comerce.test/oneclick', email: 'lgatica@protonmail.com'};
    const doc = new Document(action, params);
    parseString(doc.doc, (err, result) => {
      if (err) throw err;
      expect(result['SOAP-ENV:Envelope']['SOAP-ENV:Body'][0]['ns1:initInscription'][0]['arg0'][0]['username'][0]).to.eql('lgatica');
      expect(result['SOAP-ENV:Envelope']['SOAP-ENV:Body'][0]['ns1:initInscription'][0]['arg0'][0]['responseURL'][0]).to.eql('https://comerce.test/oneclick');
      expect(result['SOAP-ENV:Envelope']['SOAP-ENV:Body'][0]['ns1:initInscription'][0]['arg0'][0]['email'][0]).to.eql('lgatica@protonmail.com');
      done();
    });
  });
});
