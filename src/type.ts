type TypeSet = Set<Type>;

export abstract class Type {

  abstract canAssignFromImpl(other: Type): boolean;
  abstract isAny(): boolean;
  abstract toStringImpl(): string;

  isNever(): boolean {
    return false;
  }

  canAssignFrom(other: Type): boolean {
    if (other instanceof Union) {
      for (var type of other.types) {
        if (!this.canAssignFrom(type)) {
          return false;
        }
      }
      return true;
    }
    return this.canAssignFromImpl(other);
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
    return false;
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

export class Open extends Type {
  constructor(public type: Type) {
    super();
  }

  toStringImpl(): string {
    return `${this.type}+`;
  }

  canAssignFromImpl(_other: Type): boolean {
    return true; // open is ...nuts? and accepts anything...
  }

  isNever(): boolean {
    return false;
  }

  isAny(): boolean {
    return false;
  }
}

export class Named extends Type {
  constructor(public name: string, public type: Type) {
    super();
  }

  toString(): string {
    return this.toStringImpl();
  }

  toStringImpl(): string {
    if (this.type.isAny()) {
      return this.name;
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
