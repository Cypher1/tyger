import 'mocha';
import {assert} from 'chai';

import {Union, Product} from '../src/type.js';

describe('type tests', () => {
  it('constructs Never', () => {
    assert.equal(new Union([]).toString(), 'Never');
  });
  it('constructs Unit', () => {
    assert.equal(new Product([]).toString(), 'Unit');
  });
});