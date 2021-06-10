import {unit} from './type-util.js';

type TypeSet = Set<Type>;

export abstract class Type {

  abstract canAssignFromImpl(other: Type, context: Type[]): boolean;
  abstract isAnyImpl(context: Type[]): boolean;
  abstract isNeverImpl(context: Type[]): boolean;
  abstract toStringImpl(context: Type[]): string;

  isAny(context: Type[] = []): boolean {
    return this.isAnyImpl(context);
  }
  isNever(context: Type[] = []): boolean {
    return this.isNeverImpl(context);
  }

  simplify(context: Type[]): Type {
    if (this instanceof App) {
      if (this.inner instanceof Func) {
        if (this.inner.argument.canAssignFromImpl(this.argument, context)) {
          return this.inner.result;
        } else {
          return new Union(new Set());
        }
      }
    }
    return this;
  }

  canAssignFrom(other: Type, context: Type[] = []): boolean {
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

  isSuperType(other: Type, context: Type[] = []): boolean {
    return this.canAssignFrom(other, context);
  }

  isSubType(other: Type, context: Type[] = []): boolean {
    return other.canAssignFrom(this, context);
  }

  equals(other: Type, context: Type[] = []): boolean {
    return this.canAssignFrom(other, context) && other.canAssignFrom(this, context);
  }

  toString(context: Type[] = []): string {
    if (this.isAnyImpl(context)) {
      return 'Any';
    }
    if (this.isNeverImpl(context)) {
      return 'Never';
    }
    return this.toStringImpl(context);
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

  canAssignFromImpl(other: Type, context: Type[]): boolean {
    return !other.isNeverImpl(context);
  }

  isNeverImpl(_context: Type[]): boolean {
    return false;
  }

  isAnyImpl(_context: Type[]): boolean {
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

  canAssignFromImpl(other: Type, context: Type[]): boolean {
    return !other.isNeverImpl(context);
  }

  isNeverImpl(context: Type[]): boolean {
    return this.base.isNeverImpl(context) || this.expr.isNeverImpl(context);
  }

  isAnyImpl(context: Type[]): boolean {
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

  canAssignFromImpl(other: Type, context: Type[]): boolean {
    for (var type of this.types) {
      if (type.canAssignFrom(other, context)) {
        return true; // `other` can be stored in `type`
      }
    }
    return false;
  }

  isNeverImpl(context: Type[]): boolean {
    for (var type of this.types) {
      if (!type.isNeverImpl(context)) {
        return false;
      }
    }
    return true;
  }

  isAnyImpl(context: Type[]): boolean {
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

  canAssignFromImpl(other: Type, context: Type[]): boolean {
    for (var type of this.types) {
      if (!type.canAssignFrom(other, context)) {
        return false; // other must match all requirements
      }
    }
    return true;
  }

  isNeverImpl(context: Type[]): boolean {
    for (var type of this.types) {
      if (type.isNeverImpl(context)) {
        return true;
      }
    }
    return false;
  }

  isAnyImpl(context: Type[]): boolean {
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

  toString(context: Type[] = []): string {
    return this.toStringImpl(context);
  }

  toStringImpl(context: Type[]): string {
    if (this.type.isAnyImpl(context)) {
      return this.name;
    }
    if (this.type.equals(unit())) {
      return `${this.name}()`;
    }
    return `${this.name}(${this.type})`;
  }

  canAssignFromImpl(other: Type, context: Type[]): boolean {
    if (other instanceof Named && other.name === this.name) {
      return this.type.canAssignFrom(other.type, context);
    }
    return false;
  }

  isNeverImpl(context: Type[]): boolean {
    return this.type.isNeverImpl(context);
  }

  isAnyImpl(_context: Type[]): boolean {
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

  canAssignFromImpl(other: Type, context: Type[]): boolean {
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

  isNeverImpl(context: Type[]): boolean {
    for (var type of this.types) {
      if (type.isNeverImpl(context)) {
        return true;
      }
    }
    return false;
  }

  isAnyImpl(_context: Type[]): boolean {
    return false;
  }
}

// Below is a simply typed lambda calculus (Var, Func[Abs], App)
export class Var extends Type {
  constructor(public index: number, public name: string=null) {
    super();
  }

  toStringImpl(): string {
    return `$${this.name ? `${this.name}[${this.index}]` : this.index}`;
  }

  canAssignFromImpl(_other: Type, _context: Type[]): boolean {
    return false;
  }

  isNeverImpl(_context: Type[]): boolean {
    return false;
  }

  isAnyImpl(_context: Type[]): boolean {
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

  canAssignFromImpl(other: Type, context: Type[]): boolean {
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

  isNeverImpl(context: Type[]): boolean {
    if (this.result.isNeverImpl(context)) {
      return true;
    }
    return false;
  }

  isAnyImpl(_context: Type[]): boolean {
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

  canAssignFromImpl(other: Type, context: Type[]): boolean {
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

  isNeverImpl(context: Type[]): boolean {
    const thisSimple = this.simplify(context);
    if (thisSimple instanceof App) {
      return thisSimple.argument.isNeverImpl(context) || thisSimple.inner.isNeverImpl(context);
    }
    return thisSimple.isNeverImpl(context);
  }

  isAnyImpl(context: Type[]): boolean {
    const thisSimple = this.simplify(context);
    if (thisSimple instanceof App) {
      return false;
    }
    return thisSimple.isAnyImpl(context);
  }
}
