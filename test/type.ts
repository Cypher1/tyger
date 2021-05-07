import 'mocha';
import {assert} from 'chai';

import {never, unit, intersection, any, union, named, undefined_type, null_type, func} from '../src/type-util.js';

describe('type tests', () => {
  it('constructs Never', () => {
    assert.equal(never().toString(), 'Never');
    assert.isTrue(never().isNever());
  });
  it('constructs Unit', () => {
    assert.equal(unit().toString(), 'Unit');
    assert.isFalse(unit().isNever());
  });
  it('constructs Intersection of Any and Never', () => {
    const anyAndNever = intersection(any(), never());
    assert.equal(anyAndNever.toString(), '(Any&Never)');
    assert.isTrue(anyAndNever.isNever());
  });
  it('constructs Intersection of Any and Any', () => {
    const anyAndAny = intersection(any(), any());
    assert.equal(anyAndAny.toString(), '(Any&Any)');
    assert.isFalse(anyAndAny.isNever());
  });
  it('constructs Open of Never', () => {
    assert.equal(any().toString(), 'Any');
    assert.isFalse(any().isNever());
  });
  it('constructs dumb bit type', () => {
    const zero = unit();
    const one = intersection(unit());
    const bit = union(zero, one);
    assert.equal(bit.toString(), '(Unit|(&Unit))');
    assert.isFalse(bit.isNever());
  });
  it('named never', () => {
    const impossible = named('impossible', never());
    assert.equal(impossible.toString(), 'impossible(Never)');
    assert.isTrue(impossible.isNever());
  });
  it('undefined type', () => {
    assert.equal(undefined_type().toString(), 'undefined(Unit)');
    assert.isFalse(undefined_type().isNever());
    assert.isFalse(undefined_type().canAssignFrom(unit()), 'unit is not undefined');
    assert.isTrue(unit().canAssignFrom(undefined_type()), 'undefined is a unit');
    assert.isTrue(undefined_type().equals(undefined_type()), 'undefined is a undefined');
    assert.isTrue(undefined_type().canAssignFrom(undefined_type()), 'undefined is assignable to undefined');
  });
  it('null type', () => {
    assert.equal(null_type().toString(), 'null(Unit)');
    assert.isFalse(null_type().isNever());
    assert.isFalse(null_type().canAssignFrom(unit()), 'unit is not null');
    assert.isTrue(unit().canAssignFrom(null_type()), 'null is a unit');
    assert.isTrue(null_type().equals(null_type()), 'null is a null');
    assert.isTrue(null_type().canAssignFrom(null_type()), 'null is assignable to null');
  });
  it('null !== undefined', () => {
    assert.isFalse(undefined_type().canAssignFrom(null_type()), 'null cannot be assigned to undefined');
    assert.isFalse(null_type().canAssignFrom(undefined_type()), 'undefined cannot be assigned to null');
    assert.isFalse(undefined_type().equals(null_type()), 'undefined != null');
    assert.isFalse(null_type().equals(undefined_type()), 'null != undefined');
  });
  it('function type', () => {
    const namedA = named('a', any());
    const id = func(namedA, namedA);
    assert.equal(id.toString(), 'a(Any)->a(Any)');
    assert.isTrue(id.canAssignFrom(id), 'id function is assignable id function');
    assert.isTrue(id.equals(id), 'id function equals id function');
  });
  it('non equal function types', () => {
    const namedA = named('a', any());
    const namedB = named('b', any());
    const idA = func(namedA, namedA);
    const idB = func(namedB, namedB);
    assert.isFalse(idA.canAssignFrom(idB), 'non equal id functions !equals id function');
    assert.isFalse(idB.canAssignFrom(idA), 'non equal id functions !equals id function');
    assert.isFalse(idB.equals(idB), 'id function is assignable id function');
  });
});
