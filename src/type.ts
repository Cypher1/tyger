import {unit} from './type-util.js';

type TypeSet = Set<Type>;

export abstract class Type {

  abstract canAssignFromImpl(other: Type, depth?: number): boolean;
  abstract isAny(): boolean;
  abstract isNever(): boolean;
  abstract toStringImpl(): string;

  unsubstitutable(): boolean {
    return this instanceof Any || this instanceof Named || this instanceof Never;
  }

  shift(delta: number, cutoff: number = 0): Type {
    if (this.unsubstitutable()) {
      return this;
    } else if (this instanceof Var) {
      if (this.index < cutoff) {
        return this;
      } else {
        return new Var(this.index+delta, this.name);
      }
    } else if (this instanceof Func) {
      const result = this.result.shift(delta, cutoff+1);
      const argument = this.argument.shift(delta, cutoff+1);
      return new Func(argument, result);
    } else if (this instanceof App) {
      const inner = this.inner.shift(delta, cutoff);
      const argument = this.argument.shift(delta, cutoff);
      return new App(inner, argument);
    } else if (this instanceof Refined) {
      const base = this.base.shift(delta, cutoff);
      const expr = this.expr.shift(delta, cutoff);
      return new Refined(base, expr);
    } else if (this instanceof Union) {
      let tys = new Set([]);
      for (const ty of this.types) {
        tys.add(ty.shift(delta, cutoff));
      }
      return new Union(tys);
    }
    throw new Error(`unknown type for shift ${this}`);
  }

  subst(index: number, val: Type, cutoff: number = 0): Type {
    if (this.unsubstitutable()) {
      return this;
    } else if (this instanceof Var) {
      if (this.index === index) {
        return val;
      } else {
        return this;
      }
    } else if (this instanceof Func) {
      const result = this.result.subst(index+1, val.shift(1), cutoff);
      const argument = this.argument.subst(index, val, cutoff); // DUNNO
      return new Func(argument, result);
    } else if (this instanceof App) {
      const inner = this.inner.subst(index, val, cutoff);
      const argument = this.argument.subst(index, val, cutoff);
      return new App(inner, argument);
    } else if (this instanceof Refined) {
      const base = this.base.subst(index, val, cutoff);
      const expr = this.expr.subst(index, val, cutoff);
      return new Refined(base, expr);
    } else if (this instanceof Union) {
      let tys = new Set([]);
      for (const ty of this.types) {
        tys.add(ty.subst(index, val, cutoff));
      }
      return new Union(tys);
    }
    console.log('Error', this);
    throw new Error(`unknown type for subst ${this}`);
  }

  eval(depth: number=0): Type {
    // console.log('  '.repeat(depth), '>>', this.toStringImpl());
    const res = this.evalImpl(depth);
    // console.log('  '.repeat(depth), '<<', res.toStringImpl());
    return res;
  }

  evalImpl(depth: number): Type {
    if (this instanceof App) {
      const inner = this.inner.eval(depth+1);
      const argument = this.argument.eval(depth+1);
      if (inner instanceof Func && !(argument instanceof Var)) {
        if (inner.argument.canAssignFromImpl(argument, depth+1)) {
          return inner.result.subst(0, argument.shift(1)).shift(-1).eval(depth+1);
        } else {
          return new Union(new Set());
        }
      }
      return new App(inner, argument);
    }
    if (this instanceof Func) {
      return new Func(this.argument.eval(depth+1), this.result.eval(depth+1));
    }
    return this;
  }

  canAssignFrom(other: Type, depth: number = 0): boolean {
    const otherSimple = other.eval(depth+1);
    const thisSimple = this.eval(depth+1);
    if (otherSimple instanceof Union) {
      for (var type of otherSimple.types) {
        if (!thisSimple.canAssignFrom(type, depth+1)) {
          return false;
        }
      }
      return true;
    }

    return thisSimple.canAssignFromImpl(otherSimple, depth+1);
  }

  isSuperType(other: Type): boolean {
    return this.canAssignFrom(other);
  }

  isSubType(other: Type): boolean {
    return other.canAssignFrom(this);
  }

  equals(other: Type): boolean {
    return this.canAssignFrom(other) && other.canAssignFrom(this);
  }

  toString(): string {
    if (this.isAny()) {
      return 'Any';
    }
    if (this.isNever()) {
      return 'Never';
    }
    return this.toStringImpl();
  }
}

export class Any extends Type {
  /* This is the 'Any' type, similar to '*', Value or the Hask category. */
  constructor() {
    super();
  }

  toStringImpl(): string {
    return 'Any';
  }

  canAssignFromImpl(other: Type): boolean {
    return !other.isNever();
  }

  isNever(): boolean {
    return false;
  }

  isAny(): boolean {
    return true;
  }
}

export class Never extends Type {
  /* This is the 'Never' type, similar to void. */
  constructor() {
    super();
  }

  toStringImpl(): string {
    return 'Never';
  }

  canAssignFromImpl(other: Type): boolean {
    return other.eval().isNever();
  }

  isNever(): boolean {
    return true;
  }

  isAny(): boolean {
    return false;
  }
}

export class Refined extends Type {
  constructor(public base: Type, public expr: Type) {
    // expr is an abstract type that must evaluate a non-never value for each value of base that
    // is valid.
    // e.g. Refined(Int, \value. if value >= 0 then Any else Never) == Even
    // e.g. Refined(Nat, \value. if value >= 0 then Any else Never) == Nat
    super();
  }

  toStringImpl(): string {
    return `{${this.base}|${this.expr}}`;
  }

  canAssignFromImpl(other: Type): boolean {
    return !other.isNever();
  }

  isNever(): boolean {
    return this.base.isNever() || this.expr.isNever();
  }

  isAny(): boolean {
    return this.base.isAny() && this.expr.isAny();
  }
}

export class Union extends Type {
  constructor(public types: TypeSet) {
    super();
  }

  toStringImpl(): string {
    const op = '|';
    const marker = (this.types.size === 1) ? op : '';
    return `(${marker}${[...this.types].map(x => x.toString()).join(op)})`;
  }

  canAssignFromImpl(other: Type): boolean {
    for (var type of this.types) {
      if (type.canAssignFrom(other)) {
        return true; // `other` can be stored in `type`
      }
    }
    return other.isNever();
  }

  isNever(): boolean {
    for (var type of this.types) {
      if (!type.isNever()) {
        return false;
      }
    }
    return true;
  }

  isAny(): boolean {
    for (var type of this.types) {
      if (type.isNever()) {
        return true;
      }
    }
    return false;
  }
}

export class Intersection extends Type {
  constructor(public types: TypeSet) {
    super();
  }

  toStringImpl(): string {
    const op = '&';
    const marker = (this.types.size === 1) ? op : '';
    return `(${marker}${[...this.types].map(x => x.toString()).join(op)})`;
  }

  canAssignFromImpl(other: Type): boolean {
    for (var type of this.types) {
      if (!type.canAssignFrom(other)) {
        return false; // other must match all requirements
      }
    }
    return true;
  }

  isNever(): boolean {
    for (var type of this.types) {
      if (type.isNever()) {
        return true;
      }
    }
    return false;
  }

  isAny(): boolean {
    for (var type of this.types) {
      if (!type.isAny()) {
        return false;
      }
    }
    return true;
  }
}

export class Named extends Type {
  constructor(public name: string, public type: Type) {
    super();
  }

  toStringImpl(): string {
    if (this.type.isAny()) {
      return this.name;
    }
    if (this.type.equals(unit())) {
      return `${this.name}()`;
    }
    return `${this.name}(${this.type})`;
  }

  canAssignFromImpl(other: Type): boolean {
    if (other instanceof Named && other.name === this.name) {
      return this.type.canAssignFrom(other.type);
    }
    return false;
  }

  isNever(): boolean {
    return this.type.isNever();
  }

  isAny(): boolean {
    return false;
  }
}

export class Product extends Type {
  constructor(public types: Type[]) {
    super();
  }

  toStringImpl(): string {
    if (this.types.length === 0) {
      return `Unit`;
    }
    return `(${this.types.map(x => x.toString()).join('*')})`;
  }

  canAssignFromImpl(other: Type): boolean {
    if (other instanceof Product) {
      if (this.types.length === other.types.length) {
        for (var ind in this.types) {
          const type = this.types[ind];
          const other_type = other.types[ind];
          if (!type.canAssignFrom(other_type)) {
            return false;
          }
        }
        return true;
      }
    }
    return false;
  }

  isNever(): boolean {
    for (var type of this.types) {
      if (type.isNever()) {
        return true;
      }
    }
    return false;
  }

  isAny(): boolean {
    return false;
  }
}

// Below is a simply typed lambda calculus (Var, Func[Abs], App)
export class Var extends Type {
  constructor(public index: number, public name: string=null) {
    super();
  }

  toStringImpl(): string {
    return `$${this.index}${this.name ? `#${this.name}` : ``}`;
  }

  canAssignFromImpl(other: Type): boolean {
    // All we know is that we can assign if they are the same variable
    return (other instanceof Var && this.index == other.index);
  }

  isNever(): boolean {
    return false;
  }

  isAny(): boolean {
    return false;
  }
}

export class Func extends Type {
  constructor(public argument: Type, public result: Type) {
    super();
  }

  toStringImpl(): string {
    return `${this.argument}->${this.result}`;
  }

  canAssignFromImpl(other: Type): boolean {
    if (other instanceof Func) {
      // a->b <: c->d iff (c <: a) and (d <: b)
      if (!other.argument.canAssignFromImpl(this.argument)) {
        return false; // the arguments cannot be assigned
      }
      if (!this.result.canAssignFromImpl(other.result)) {
        return false; // the results cannot be assigned
      }
      return true;
    }
    return false;
  }

  isNever(): boolean {
    if (this.result.isNever()) {
      return true;
    }
    return false;
  }

  isAny(): boolean {
    return false;
  }
}

export class App extends Type {
  constructor(public inner: Type, public argument: Type) {
    super();
  }

  toStringImpl(): string {
    return `(${this.inner})(${this.argument})`;
  }

  canAssignFromImpl(other: Type): boolean {
    if (other instanceof App) {
      // a->b <: c->d iff (c <: a) and (d <: b)
      if (!other.argument.canAssignFromImpl(this.argument)) {
        return false; // the arguments cannot be assigned
      }
      if (!this.inner.canAssignFromImpl(other.inner)) {
        return false; // the results cannot be assigned
      }
      return true;
    }
    return false;
  }

  isNever(): boolean {
    const thisSimple = this.eval();
    if (thisSimple instanceof App) {
      return thisSimple.argument.isNever() || thisSimple.inner.isNever();
    }
    return thisSimple.isNever();
  }

  isAny(): boolean {
    const thisSimple = this.eval();
    if (thisSimple instanceof App) {
      return false;
    }
    return thisSimple.isAny();
  }
}
