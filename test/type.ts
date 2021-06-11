import 'mocha';
import {assert} from 'chai';

import {never, unit, intersection, any, union, named, undefined_type, null_type, func, app, churchT, churchF, varT} from '../src/type-util.js';

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
    assert.equal(anyAndNever.toString(), 'Never');
    assert.isTrue(anyAndNever.isNever());
  });
  it('constructs Intersection of Any and Any', () => {
    const anyAndAny = intersection(any(), any());
    assert.equal(anyAndAny.toString(), 'Any');
    assert.isFalse(anyAndAny.isNever());
  });
  it('constructs Any', () => {
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
    assert.equal(impossible.toString(), 'Never');
    assert.isTrue(impossible.isNever());
  });
  it('undefined type', () => {
    assert.equal(undefined_type().toString(), 'undefined()');
    assert.isFalse(undefined_type().isNever());
    assert.isFalse(undefined_type().canAssignFrom(unit()), 'unit is not undefined');
    assert.isFalse(unit().canAssignFrom(undefined_type()), 'undefined is not just a unit');
    assert.isTrue(undefined_type().equals(undefined_type()), 'undefined is a undefined');
    assert.isTrue(undefined_type().canAssignFrom(undefined_type()), 'undefined is assignable to undefined');
  });
  it('null type', () => {
    assert.equal(null_type().toString(), 'null()');
    assert.isFalse(null_type().isNever());
    assert.isFalse(null_type().canAssignFrom(unit()), 'unit is not null');
    assert.isFalse(unit().canAssignFrom(null_type()), 'null is not just a unit');
    assert.isTrue(null_type().equals(null_type()), 'null is a null');
    assert.isTrue(null_type().canAssignFrom(null_type()), 'null is assignable to null');
  });
  it('null !== undefined', () => {
    assert.isFalse(undefined_type().canAssignFrom(null_type()), 'null cannot be assigned to undefined');
    assert.isFalse(null_type().canAssignFrom(undefined_type()), 'undefined cannot be assigned to null');
    assert.isFalse(undefined_type().equals(null_type()), 'undefined != null');
    assert.isFalse(null_type().equals(undefined_type()), 'null != undefined');
  });
  describe('union type tests', () => {
    const tys = () => {
      const namedA = named('a', any()); // new type any as a
      const namedB = named('b', any()); // new type any as b
      const aOrB = union(namedA, namedB);
      return { namedA, namedB, aOrB };
    };
    it('a is a subtype of a|b', () => {
      const {namedA, namedB, aOrB} = tys();
      assert.isTrue(namedA.isSubType(aOrB), 'a is a subtype of a|b');
      assert.isTrue(namedB.isSubType(aOrB), 'b is a subtype of a|b');
    });
    it('a|b is not a subtype of a', () => {
      const {namedA, namedB, aOrB} = tys();
      assert.isFalse(aOrB.isSubType(namedA), 'a|b is not a subtype of a');
      assert.isFalse(aOrB.isSubType(namedB), 'a|b is not a subtype of b');
    });
    it('a|b is a supertype of a', () => {
      const {namedA, namedB, aOrB} = tys();
      assert.isTrue(aOrB.isSuperType(namedA), 'a|b is a supertype of a');
      assert.isTrue(aOrB.isSuperType(namedB), 'a|b is a supertype of b');
    });
    it('a is not a supertype of a|b', () => {
      const {namedA, namedB, aOrB} = tys();
      assert.isFalse(namedA.isSuperType(aOrB), 'a is not a supertype of a|b');
      assert.isFalse(namedB.isSuperType(aOrB), 'b is not a supertype of a|b');
    });
  });
  describe('function type tests', () => {
    const tys = () => {
      const namedA = named('a', any()); // new type any as a
      const namedB = named('b', any()); // new type any as b
      const idA = func(namedA, namedA);
      const idB = func(namedB, namedB);
      const aOrB = union(namedA, namedB);
      return { namedA, namedB, idA, idB, aOrB };
    };
    it('function type', () => {
      const id = tys().idA;
      assert.equal(id.toString(), 'a->a');
      assert.isTrue(id.canAssignFrom(id), 'id function is assignable to an id function');
      assert.isTrue(id.equals(id), 'id function equals id function');
    });
    it('non equal function types', () => {
      const {idA, idB} = tys();
      assert.isFalse(idA.canAssignFrom(idB), 'non equal id functions !equals id function');
      assert.isFalse(idB.canAssignFrom(idA), 'non equal id functions !equals id function');
      assert.isFalse(idA.equals(idB), 'idA != idB');
      assert.isFalse(idB.equals(idA), 'idB != idA');
    });
    it('sub typing function types', () => {
      const {namedA, aOrB} = tys();
      const abstractingId = func(namedA, aOrB);
      const subtypingId = func(aOrB, namedA);

      assert.equal(abstractingId.toString(), 'a->(a|b)');
      assert.equal(subtypingId.toString(), '(a|b)->a');

      assert.isTrue(abstractingId.canAssignFrom(subtypingId), 'non equal id functions !equals id function');
      assert.isFalse(subtypingId.canAssignFrom(abstractingId), 'non equal id functions !equals id function');
      assert.isFalse(abstractingId.equals(subtypingId), 'abstractingId != subtypingId');
      assert.isFalse(subtypingId.equals(abstractingId), 'subtypingId != abstractingId');
    });
    describe('function application', () => {
      const inner_tys = () => {
        const obj = tys();
        const dropF = func(obj.namedB, func(obj.namedA, obj.namedA));
        return {dropF, ...obj};
      };
      it('apply on functions', () => {
        const {namedA, namedB, idA, dropF} = inner_tys();

        const dropFAppd = app(dropF, namedB);
        const dropFMissAppd = app(dropF, namedA);

        assert.equal(dropF.toString(), 'b->a->a');
        assert.equal(dropFAppd.toString(), '(b->a->a)(b)');

        assert.equal(dropFAppd.eval([]).toString(), 'a->a');
        assert.isTrue(idA.equals(dropFAppd), '(1) applying an argument produces the inner');
        assert.isTrue(dropFAppd.equals(idA), '(2) applying an argument produces the inner');
        assert.isTrue(dropFMissAppd.equals(never()), 'applying a non-matching argument produces never');
        assert.isFalse(dropFAppd.isNever(), 'evaling a valid type is not never');
        assert.isTrue(dropFMissAppd.isNever(), 'evaling an invalid type is never');
      });
    });
    describe('variables as types', () => {
      it('left vs right', () => {
        const left = varT(3, 'left');
        const right = varT(4, 'right');
        assert.equal(left.toString(), '$3#left');
        assert.equal(right.toString(), '$4#right');
        assert.equal(left.eval([]).toString(), '$3#left');
        assert.equal(right.eval([]).toString(), '$4#right');
        assert.isTrue(left.canAssignFrom(left), 'can assign left to left');
        assert.isTrue(right.canAssignFrom(right), 'can assign right to right');
        assert.isFalse(left.canAssignFrom(right), 'cannot assign right to left');
        assert.isFalse(right.canAssignFrom(left), 'cannot assign left to right');
      });
    });
    describe('church bools as types', () => {
      it('true', () => {
        const t = churchT();
        const left = varT(3, 'left');
        const right = varT(4, 'right');
        assert.equal(t.toString(), 'Any->Any->$0#t');
        const ifLeft = app(app(t, left), right);
        assert.equal(ifLeft.toString(), '((Any->Any->$0#t)($3#left))($4#right)');
        assert.equal(ifLeft.eval([]).toString(), '$3#left');
        assert.isTrue(ifLeft.canAssignFrom(left));
        assert.isFalse(ifLeft.canAssignFrom(right));
      });
      it('false', () => {
        const f = churchF();
        const left = varT(3, 'left');
        const right = varT(4, 'right');
        assert.equal(f.toString(), 'Any->Any->$1#f');
        const ifRight = app(app(f, left), right);
        assert.equal(ifRight.toString(), '((Any->Any->$1#f)($3#left))($4#right)');
        assert.equal(ifRight.eval([]).toString(), '$4#right');
        assert.isTrue(ifRight.canAssignFrom(right));
        assert.isFalse(ifRight.canAssignFrom(left));
      });
    });
  });
});
