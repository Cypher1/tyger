import {unit} from './type-util.js';

type TypeSet = Set<Type>;

type Context = Type[];

function defaultContext(): Context {
  return [];
}

function extend(curr: Context, t: Type): Context {
  return [...curr, t];
}

function getTypeFrom(curr: Context, v: Var): Type {
  if (v.index < curr.length) {
    return curr[curr.length-1-v.index];
  }
  return null;
}

export abstract class Type {

  abstract canAssignFromImpl(other: Type, context: Context): boolean;
  abstract isAnyImpl(context: Context): boolean;
  abstract isNeverImpl(context: Context): boolean;
  abstract toStringImpl(context: Context): string;

  isAny(context: Context = defaultContext()): boolean {
    return this.isAnyImpl(context);
  }
  isNever(context: Context = defaultContext()): boolean {
    return this.isNeverImpl(context);
  }

  simplify(context: Context, depth: number=0): Type {
    //console.log('  '.repeat(depth), 'simplify ', this.toStringImpl([]));
    //console.log('  '.repeat(depth), context);
    const res = this.simplifyImpl(context, depth);
    //console.log('  '.repeat(depth), res.toStringImpl([]));
    return res;
  }

  simplifyImpl(context: Context, depth: number): Type {
    if (this instanceof App) {
      const arg = this.argument.simplify(context, depth+1);
      const newContext = extend(context, arg);
      const inner = this.inner.simplify(newContext, depth+1);
      if (inner instanceof Func) {
        // Typed beta reduction
        if (inner.argument.canAssignFromImpl(arg, newContext)) {
          return inner.result;
        } else {
          return new Union(new Set());
        }
      }
      return new App(inner, arg);
    }
    if (this instanceof Func) {
      return new Func(this.argument.simplify(context, depth+1), this.result.simplify(context, depth+1));
    }
    if (this instanceof Var) {
      const val = getTypeFrom(context, this);
      return val ? val : this;
    }
    return this;
  }

  canAssignFrom(other: Type, context: Context = defaultContext()): boolean {
    const otherSimple = other.simplify(context);
    const thisSimple = this.simplify(context);
    if (otherSimple instanceof Union) {
      for (var type of otherSimple.types) {
        if (!thisSimple.canAssignFrom(type, context)) {
          return false;
        }
      }
      return true;
    }

    return thisSimple.canAssignFromImpl(otherSimple, context);
  }

  isSuperType(other: Type, context: Context = defaultContext()): boolean {
    return this.canAssignFrom(other, context);
  }

  isSubType(other: Type, context: Context = defaultContext()): boolean {
    return other.canAssignFrom(this, context);
  }

  equals(other: Type, context: Context = defaultContext()): boolean {
    return this.canAssignFrom(other, context) && other.canAssignFrom(this, context);
  }

  toString(): string {
    if (this.isAnyImpl([])) {
      return 'Any';
    }
    if (this.isNeverImpl([])) {
      return 'Never';
    }
    return this.toStringImpl([]);
  }
}

export class Any extends Type {
  /* This is the 'Any' type, similar to '*', Value or the Hask category. */
  constructor() {
    super();
  }

  toStringImpl(): string {
    return '*';
  }

  canAssignFromImpl(other: Type, context: Context): boolean {
    return !other.isNeverImpl(context);
  }

  isNeverImpl(_context: Context): boolean {
    return false;
  }

  isAnyImpl(_context: Context): boolean {
    return true;
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

  canAssignFromImpl(other: Type, context: Context): boolean {
    return !other.isNeverImpl(context);
  }

  isNeverImpl(context: Context): boolean {
    return this.base.isNeverImpl(context) || this.expr.isNeverImpl(context);
  }

  isAnyImpl(context: Context): boolean {
    return this.base.isAnyImpl(context) && this.expr.isAnyImpl(context);
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

  canAssignFromImpl(other: Type, context: Context): boolean {
    for (var type of this.types) {
      if (type.canAssignFrom(other, context)) {
        return true; // `other` can be stored in `type`
      }
    }
    return false;
  }

  isNeverImpl(context: Context): boolean {
    for (var type of this.types) {
      if (!type.isNeverImpl(context)) {
        return false;
      }
    }
    return true;
  }

  isAnyImpl(context: Context): boolean {
    for (var type of this.types) {
      if (type.isNeverImpl(context)) {
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

  canAssignFromImpl(other: Type, context: Context): boolean {
    for (var type of this.types) {
      if (!type.canAssignFrom(other, context)) {
        return false; // other must match all requirements
      }
    }
    return true;
  }

  isNeverImpl(context: Context): boolean {
    for (var type of this.types) {
      if (type.isNeverImpl(context)) {
        return true;
      }
    }
    return false;
  }

  isAnyImpl(context: Context): boolean {
    for (var type of this.types) {
      if (!type.isAnyImpl(context)) {
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

  toStringImpl(context: Context): string {
    if (this.type.isAnyImpl(context)) {
      return this.name;
    }
    if (this.type.equals(unit())) {
      return `${this.name}()`;
    }
    return `${this.name}(${this.type})`;
  }

  canAssignFromImpl(other: Type, context: Context): boolean {
    if (other instanceof Named && other.name === this.name) {
      return this.type.canAssignFrom(other.type, context);
    }
    return false;
  }

  isNeverImpl(context: Context): boolean {
    return this.type.isNeverImpl(context);
  }

  isAnyImpl(_context: Context): boolean {
    return false;
  }
}

export class Product extends Type {
  constructor(public types: Context) {
    super();
  }

  toStringImpl(): string {
    if (this.types.length === 0) {
      return `Unit`;
    }
    return `(${this.types.map(x => x.toString()).join('*')})`;
  }

  canAssignFromImpl(other: Type, context: Context): boolean {
    if (other instanceof Product) {
      if (this.types.length === other.types.length) {
        for (var ind in this.types) {
          const type = this.types[ind];
          const other_type = other.types[ind];
          if (!type.canAssignFrom(other_type, context)) {
            return false;
          }
        }
        return true;
      }
    }
    return false;
  }

  isNeverImpl(context: Context): boolean {
    for (var type of this.types) {
      if (type.isNeverImpl(context)) {
        return true;
      }
    }
    return false;
  }

  isAnyImpl(_context: Context): boolean {
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

  canAssignFromImpl(other: Type, _context: Context): boolean {
    // All we know is that we can assign if they are the same variable
    return (other instanceof Var && this.index == other.index);
  }

  isNeverImpl(_context: Context): boolean {
    return false;
  }

  isAnyImpl(_context: Context): boolean {
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

  canAssignFromImpl(other: Type, context: Context): boolean {
    if (other instanceof Func) {
      // a->b <: c->d iff (c <: a) and (d <: b)
      if (!other.argument.canAssignFromImpl(this.argument, context)) {
        return false; // the arguments cannot be assigned
      }
      if (!this.result.canAssignFromImpl(other.result, context)) {
        return false; // the results cannot be assigned
      }
      return true;
    }
    return false;
  }

  isNeverImpl(context: Context): boolean {
    if (this.result.isNeverImpl(context)) {
      return true;
    }
    return false;
  }

  isAnyImpl(_context: Context): boolean {
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

  canAssignFromImpl(other: Type, context: Context): boolean {
    if (other instanceof App) {
      // a->b <: c->d iff (c <: a) and (d <: b)
      if (!other.argument.canAssignFromImpl(this.argument, context)) {
        return false; // the arguments cannot be assigned
      }
      if (!this.inner.canAssignFromImpl(other.inner, context)) {
        return false; // the results cannot be assigned
      }
      return true;
    }
    return false;
  }

  isNeverImpl(context: Context): boolean {
    const thisSimple = this.simplify(context);
    if (thisSimple instanceof App) {
      return thisSimple.argument.isNeverImpl(context) || thisSimple.inner.isNeverImpl(context);
    }
    return thisSimple.isNeverImpl(context);
  }

  isAnyImpl(context: Context): boolean {
    const thisSimple = this.simplify(context);
    if (thisSimple instanceof App) {
      return false;
    }
    return thisSimple.isAnyImpl(context);
  }
}
