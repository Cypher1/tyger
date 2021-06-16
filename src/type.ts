import {unit} from './type-util.js';

type TypeSet = Set<Type>;

const startDepth = '';
type Depth = string;

export abstract class Type {
  private evaluated = null;

  abstract canAssignFromImpl(other: Type, depth?: Depth): boolean;
  abstract isAny(depth?: Depth): boolean;
  abstract isSatisfiableImpl(depth?: Depth): boolean;
  abstract toStringImpl(): string;

  isSatisfiable(depth?: Depth): boolean {
    if (this.isAny(depth)) {
      return true;
    }
    return this.isSatisfiableImpl(depth);
  }

  isNever(depth?: Depth): boolean {
    return !this.isSatisfiable(depth);
  }

  unsubstitutable(): boolean {
    return this instanceof Any || this instanceof Named || this instanceof Never;
  }

  shift(delta: number, cutoff: number=0): Type {
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
    } else if (this instanceof Fallback) {
      const ty = this.ty.shift(delta, cutoff);
      const def = this.def.shift(delta, cutoff);
      return new Fallback(ty, def);
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

  subst(index: number, val: Type, cutoff: Depth): Type {
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
    } else if (this instanceof Fallback) {
      const ty = this.ty.subst(index, val, cutoff);
      const def = this.def.subst(index, val, cutoff);
      return new Fallback(ty, def);
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

  evalForTest(): Type {
    return this.eval(startDepth);
  }

  eval(depth: Depth): Type {
    if (this.evaluated) {
      console.log(depth, '..', this.toStringImpl(), '=>', this.evaluated.toStringImpl());
      return this.evaluated; // TODO: Clone?
    }
    console.log(depth, '>>', this.toStringImpl());
    const res = this.evalImpl(depth+`  `);
    res.evaluated = res;
    console.log(depth, '<<', this.toStringImpl(), '=>', res.toStringImpl());
    return res;
  }

  evalImpl(depth: Depth): Type {
    if (this instanceof App) {
      const inner = this.inner; // .eval(depth);
      const argument = this.argument; // .eval(depth);
      if (inner instanceof Func && !(argument instanceof Var)) {
        if (inner.argument.canAssignFromImpl(argument, depth)) {
          return inner.result.subst(0, argument.shift(1), depth).shift(-1).eval(depth);
        } else {
          return new Union(new Set());
        }
      } else if (inner instanceof Fallback && !(argument instanceof Var)) {
        // Propagate the application inside the fallback
        const ty = new App(inner.ty, this.argument); // .eval(depth);
        const def = new App(inner.def, this.argument); // .eval(depth);
        return new Fallback(ty, def).eval(depth);
      }
      return new App(inner, argument);
    } else if (this instanceof Fallback) {
      const ty = this.ty.eval(depth);
      const def = this.def.eval(depth);
      if (ty.equals(def)) {
        return ty;
      }
      if (ty.isNever(depth)) {
        return def;
      } else if (ty.isSatisfiable(depth)) {
        return ty;
      } else {
        return this;
      }
    } else if (this instanceof Func) {
      return new Func(this.argument.eval(depth), this.result.eval(depth));
    } else if (this instanceof Intersection) {
      const tys = new Set();
      for (const ty of this.types) {
        const evaled = ty.eval(depth);
        if (evaled.isNever()) {
          return new Never();
        }
        if ([...tys].every(other => !other.equals(ty))) {
          tys.add(evaled);
        }
      }
      if (tys.size === 1) {
        return [...tys][0];
      }
      return new Intersection(tys);
    } else if (this instanceof Product) {
      const tys = [];
      for (const ty of this.types) {
        const evaled = ty.eval(depth);
        if (evaled.isNever()) {
          return new Never();
        }
        tys.push(evaled);
      }
      if (tys.length === 1) {
        return [...tys][0];
      }
      return new Product(tys);
    } else if (this instanceof Union) {
      const tys = new Set();
      for (const ty of this.types) {
        const evaled = ty.eval(depth);
        if (evaled.isSatisfiable() && [...tys].every(other => !other.equals(ty))) {
          tys.add(evaled);
        }
      }
      if (tys.size === 1) {
        return [...tys][0];
      } else if (tys.size === 0) {
        return new Never();
      }
      return new Union(tys);
    }
    return this;
  }

  canAssignFrom(other: Type, depth: string=startDepth): boolean {
    const otherSimple = other.eval(depth);
    const thisSimple = this.eval(depth);
    if (otherSimple instanceof Union) {
      for (var type of otherSimple.types) {
        if (!thisSimple.canAssignFrom(type, depth)) {
          return false;
        }
      }
      return !otherSimple.isNever();
    } else if (otherSimple instanceof Intersection) {
      for (var type of otherSimple.types) {
        if (thisSimple.canAssignFrom(type, depth)) {
          return true;
        }
      }
      return false;
    }
    return thisSimple.canAssignFromImpl(otherSimple, depth);
  }

  isSuperType(other: Type, depth: string=startDepth): boolean {
    return this.canAssignFrom(other, depth);
  }

  isSubType(other: Type, depth: string=startDepth): boolean {
    return other.canAssignFrom(this, depth);
  }

  equals(other: Type, depth: string=startDepth): boolean {
    return this.canAssignFrom(other, depth) && other.canAssignFrom(this, depth);
  }

  toString(_depth: string=startDepth): string {
    // if (this.isAny(depth)) {
      // return 'Any';
    // }
    // if (this.isNever(depth)) {
      // return 'Never';
    // }
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

  canAssignFromImpl(_other: Type, _depth: Depth): boolean {
    return true;
  }

  isSatisfiableImpl(): boolean {
    return true;
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

  canAssignFromImpl(other: Type, depth: Depth): boolean {
    return other.eval(depth).isNever(depth);
  }

  isSatisfiableImpl(): boolean {
    return false;
  }

  isAny(): boolean {
    return false;
  }
}

export class Fallback extends Type {
  /* This is the 'Fallback' type, similar to catch?. */
  constructor(public ty: Type, public def: Type) {
    super();
  }

  toStringImpl(): string {
    return `${this.ty}||${this.def}`;
  }

  canAssignFromImpl(other: Type, depth: Depth): boolean {
    return other.eval(depth).isNever(depth);
  }

  isSatisfiableImpl(depth?: Depth): boolean {
    return this.ty.isSatisfiable(depth) || this.def.isSatisfiable(depth);
  }

  isAny(): boolean {
    return this.ty.isAny() || (this.ty.isNever() && this.def.isAny());
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

  canAssignFromImpl(other: Type, depth: Depth): boolean {
    return !other.isNever(depth + 1);
  }

  isSatisfiableImpl(): boolean {
    // TODO: check expr is satisfiable in the context of base
    return this.base.isSatisfiable() || this.expr.isSatisfiable();
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

  canAssignFromImpl(other: Type, depth: Depth): boolean {
    console.log('canAssignFromImpl Union', this.toStringImpl(), other.toStringImpl());
    for (var type of this.types) {
      if (type.canAssignFrom(other, depth)) {
        return true; // `other` can be stored in `type`
      }
    }
    return other.isNever();
  }

  isSatisfiableImpl(): boolean {
    for (var type of this.types) {
      if (type.isSatisfiable()) {
        return true;
      }
    }
    return false;
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

  canAssignFromImpl(other: Type, depth: Depth): boolean {
    for (var type of this.types) {
      if (!type.canAssignFrom(other, depth + 1)) {
        return false; // other must match all requirements
      }
    }
    return true;
  }

  isSatisfiableImpl(depth: Depth): boolean {
    for (var type of this.types) {
      if (!type.isSatisfiable(depth + 1)) {
        return false;
      }
    }
    // TODO: Check that the intersections are not empty
    return true;
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

  canAssignFromImpl(other: Type, depth: Depth): boolean {
    console.log('canAssignFromImpl Named', this.toStringImpl(), other.toStringImpl());
    if (!(other instanceof Named)) {
      console.log('canAssignFromImpl Named(2)', this.toStringImpl(), other.toStringImpl());
      return false;
    }
    if (other.name !== this.name) {
      console.log('canAssignFromImpl Named(3)', this.toStringImpl(), other.toStringImpl());
      return false;
    }
    if (!this.type.canAssignFrom(other.type, depth)) {
      console.log('canAssignFromImpl Named(4)', this.toStringImpl(), other.toStringImpl());
      return false;
    }
    console.log('canAssignFromImpl Named(5)', this.toStringImpl(), other.toStringImpl());
    return true;
  }

  isSatisfiableImpl(): boolean {
    return this.type.isSatisfiable();
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

  canAssignFromImpl(other: Type, depth: Depth): boolean {
    if (other instanceof Product) {
      if (this.types.length === other.types.length) {
        for (var ind in this.types) {
          const type = this.types[ind];
          const other_type = other.types[ind];
          if (!type.canAssignFrom(other_type, depth)) {
            return false;
          }
        }
        return true;
      }
    }
    return false;
  }

  isSatisfiableImpl(): boolean {
    for (var type of this.types) {
      if (!type.isSatisfiable()) {
        return false;
      }
    }
    // TODO: Check that the intersections are not empty
    return true;
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

  canAssignFromImpl(other: Type, _depth: Depth): boolean {
    // All we know is that we can assign if they are the same variable
    return (other instanceof Var && this.index == other.index);
  }

  isSatisfiableImpl(): boolean {
    return true;
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

  canAssignFromImpl(other: Type, depth: Depth): boolean {
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

  isSatisfiableImpl(): boolean {
    return (this.result.isSatisfiable() && this.argument.isSatisfiable());
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

  canAssignFromImpl(other: Type, _depth: string=startDepth): boolean {
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

  isSatisfiableImpl(): boolean {
    const thisSimple = this.eval(startDepth);
    if (thisSimple instanceof App) {
      return thisSimple.inner.isSatisfiable();// TODO: && thisSimple.argument.isSatisfiable());
    }
    return thisSimple.isSatisfiable();
  }

  isAny(): boolean {
    const thisSimple = this.eval(startDepth);
    if (thisSimple instanceof App) {
      return false;
    }
    return thisSimple.isAny();
  }
}
