import 'mocha';
import {assert} from 'chai';

import {Union, Intersection, Open} from '../src/type.js';

describe('type tests', () => {
  it('constructs Never', () => {
    assert.equal(new Union([]).toString(), 'Never');
  });
  it('constructs Unit', () => {
    assert.equal(new Intersection([]).toString(), 'Unit');
  });
  it('constructs Open of Never', () => {
    assert.equal(new Open(new Union([])).toString(), 'Any');
  });
});
