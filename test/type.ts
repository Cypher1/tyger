import 'mocha';
import {assert} from 'chai';

import {never, unit, intersection, any, union, named, undefined_type, null_type, func, app, applyAll,
  churchT, churchF, churchBool, churchAnd, churchOr, churchNot, churchNat, churchPlus, requireType,
  isType, fallback
} from '../src/type-util.js';

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
    assert.equal(anyAndNever.evalForTest().toString(), 'Never');
    assert.isTrue(anyAndNever.evalForTest().isNever());
  });
  it('constructs Intersection of Any and Any', () => {
    const anyAndAny = intersection(any(), any());
    assert.equal(anyAndAny.evalForTest().toString(), 'Any');
    assert.isFalse(anyAndAny.evalForTest().isNever());
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
    assert.equal(impossible.toString(), 'impossible(Never)');
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

        assert.equal(dropFAppd.evalForTest().toString(), 'a->a');
        assert.isTrue(idA.equals(dropFAppd), '(1) applying an argument produces the inner');
        assert.isTrue(dropFAppd.equals(idA), '(2) applying an argument produces the inner');
        assert.isTrue(dropFMissAppd.equals(never()), 'applying a non-matching argument produces never');
        assert.equal(dropFMissAppd.evalForTest().toString(), 'Never', 'applying a non-matching argument produces never');
        assert.isFalse(dropFAppd.isNever(), 'evaling a valid type is not never');
        assert.isTrue(dropFMissAppd.isNever(), 'evaling an invalid type is never');
      });
    });
    describe('variables as types', () => {
      it('left vs right', () => {
        const left = named('left', any());
        const right = named('right', any());
        assert.equal(left.toString(), 'left');
        assert.equal(right.toString(), 'right');
        assert.equal(left.evalForTest().toString(), 'left');
        assert.equal(right.evalForTest().toString(), 'right');
        assert.isTrue(left.canAssignFrom(left), 'can assign left to left');
        assert.isTrue(right.canAssignFrom(right), 'can assign right to right');
        assert.isFalse(left.canAssignFrom(right), 'cannot assign right to left');
        assert.isFalse(right.canAssignFrom(left), 'cannot assign left to right');
      });
    });
    describe('church bools as types', () => {
      it('true', () => {
        const t = churchT();
        const left = named('left', any());
        const right = named('right', any());
        assert.equal(t.toStringImpl(), 'Any->Any->$1#t');
        const ifLeft = app(app(t, left), right);
        assert.equal(ifLeft.toStringImpl(), '((Any->Any->$1#t)(left))(right)');
        assert.equal(ifLeft.evalForTest().toStringImpl(), 'left');
        assert.isTrue(ifLeft.canAssignFrom(left));
        assert.isFalse(ifLeft.canAssignFrom(right));
      });
      it('false', () => {
        const f = churchF();
        const left = named('left', any());
        const right = named('right', any());
        assert.equal(f.toString(), 'Any->Any->$0#f');
        const ifRight = app(app(f, left), right);
        assert.equal(ifRight.toString(), '((Any->Any->$0#f)(left))(right)');
        assert.equal(ifRight.evalForTest().toString(), 'right');
        assert.isTrue(ifRight.canAssignFrom(right));
        assert.isFalse(ifRight.canAssignFrom(left));
      });
      it('not', () => {
        const left = named('left', any());
        const right = named('right', any());
        const not = churchNot();
        for (const a of [true, false]) {
          const notA = applyAll(not, churchBool(a), left, right).evalForTest();
          const expectedB = !a;
          const expected = expectedB ? left : right;
          assert.equal(notA.toString(), expected.toString(), `!${a} -> ${expectedB}`);
        }
      });
      it('and', () => {
        const left = named('left', any());
        const right = named('right', any());
        const and = churchAnd();
        for (const a of [true, false]) {
          for (const b of [true, false]) {
            const andAB = applyAll(and, churchBool(a), churchBool(b), left, right).evalForTest();
            const expectedB = a && b;
            const expected = expectedB ? left : right;
            assert.equal(andAB.toString(), expected.toString(), `${a} && ${b} -> ${expectedB}`);
          }
        }
      });
      it('or', () => {
        const left = named('left', any());
        const right = named('right', any());
        const or = churchOr();
        for (const a of [true, false]) {
          for (const b of [true, false]) {
            const orAB = applyAll(or, churchBool(a), churchBool(b), left, right).evalForTest();
            const expectedB = a || b;
            const expected = expectedB ? left : right;
            assert.equal(orAB.toString(), expected.toString(), `${a} || ${b} -> ${expectedB}`);
          }
        }
      });
    });
    describe('church nats as types', () => {
      it('0', () => {
        const n = churchNat(0);
        assert.equal(n.toString(), 'Any->Any->$0#x');
        const startV = named('start', any());
        const f = named('fun', any());
        const fNTimes = applyAll(n, f, startV);
        assert.equal(fNTimes.toString(), '((Any->Any->$0#x)(fun))(start)');
        assert.equal(fNTimes.evalForTest().toString(), 'start');
      });
      it('1', () => {
        const n = churchNat(1);
        assert.equal(n.toString(), 'Any->Any->($1#f)($0#x)');
        const startV = named('start', any());
        const f = named('fun', any());
        const fNTimes = applyAll(n, f, startV);
        assert.equal(fNTimes.toString(), '((Any->Any->($1#f)($0#x))(fun))(start)');
        assert.equal(fNTimes.evalForTest().toString(), '(fun)(start)');
      });
      it('2', () => {
        const n = churchNat(2);
        assert.equal(n.toString(), 'Any->Any->($1#f)(($1#f)($0#x))');
        const startV = named('start', any());
        const f = named('fun', any());
        const fNTimes = applyAll(n, f, startV);
        assert.equal(fNTimes.toString(), '((Any->Any->($1#f)(($1#f)($0#x)))(fun))(start)');
        assert.equal(fNTimes.evalForTest().toString(), '(fun)((fun)(start))');
      });
      it('3', () => {
        const n = churchNat(3);
        assert.equal(n.toString(), 'Any->Any->($1#f)(($1#f)(($1#f)($0#x)))');
        const startV = named('start', any());
        const f = named('fun', any());
        const fNTimes = applyAll(n, f, startV);
        assert.equal(fNTimes.toString(), '((Any->Any->($1#f)(($1#f)(($1#f)($0#x))))(fun))(start)');
        assert.equal(fNTimes.evalForTest().toString(), '(fun)((fun)((fun)(start)))');
      });
      it('plus', () => {
        const plus = churchPlus();
        const three = churchNat(3);
        const four = churchNat(4);
        const startV = named('start', any());
        const f = named('fun', any());
        const res = applyAll(plus, three, four, f, startV).evalForTest();
        const sevenApp = applyAll(churchNat(7), f, startV).evalForTest();
        assert.equal(res.toString(), sevenApp.toString(), 'String equality');
        assert.isTrue(res.equals(sevenApp), 'Structural equality');
      });
    });
    describe('fallback', () => {
      it('fallback toString', () => {
        assert.equal(fallback().toString(), 'Any->Any->$1#ty||$0#def');
      });
      it('fallback of never is default', () => {
        const three = churchNat(3);
        const shouldFallback = applyAll(fallback(), never(), three);
        const evaled = shouldFallback.evalForTest();
        assert.equal(evaled.toString(), three.toString(), `${shouldFallback.toStringImpl()} is ${evaled.toString()} but should be ${three.toString()}`);
      });
      it('fallback of non-never ty is ty', () => {
        const three = churchNat(3);
        const four = churchNat(4);
        const startV = named('start', any());
        const f = named('fun', any());
        const fallbackOfAny = applyAll(fallback(), three, four, f, startV).evalForTest();
        const threeFStartV = applyAll(three, f, startV).evalForTest();
        assert.equal(fallbackOfAny.toString(), threeFStartV.toString(), 'Types should be equal');
        assert.isTrue(fallbackOfAny.equals(threeFStartV), 'We can assign to a fallback type');
      });
      it('fallback of ty and ty is ty', () => {
        const v = churchT();
        const fallbackOfAny = applyAll(fallback(), v, v);
        assert.equal(fallbackOfAny.evalForTest().toString(), v.toString());
      });
    });
    describe('requireType', () => {
      it('requireType toString', () => {
        assert.equal(requireType().toString(), 'Any->Any->($1#t->$0#v)($0#v)');
      });
      it('requireType always true for non never types', () => {
        const three = churchNat(3);
        const threeIsAny = app(app(requireType(), any()), three).evalForTest();
        assert.equal(threeIsAny.toString(), three.toString());
      });
      it('requireType always false for non never types', () => {
        const three = churchNat(3);
        const threeIsAny = app(app(requireType(), never()), three).evalForTest();
        assert.equal(threeIsAny.toString(), never().toString());
      });
    });
    describe('isType', () => {
      it('isType toString', () => {
        assert.equal(isType().toString(), 'Any->Any->Any->Any->($1#ty->$0#v)($0#v)');
      });
      it('isType always true for non never types', () => {
        const three = churchNat(3);
        const threeIsAny = app(app(isType(), any()), three).evalForTest();
        assert.equal(threeIsAny.toString(), churchT().toString());
      });
      it('isType always false for non never types', () => {
        const three = churchNat(3);
        const threeIsAny = app(app(isType(), never()), three).evalForTest();
        assert.equal(threeIsAny.toString(), churchF().toString());
      });
    });
  });
});
