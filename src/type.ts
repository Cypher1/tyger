type TypeSet = Set<Type>;

export abstract class Type {

  abstract toString(): string;
  abstract canAssignFromImpl(other: Type): boolean;
  abstract isNever(): boolean;

  canAssignFrom(other: Type): boolean {
    if (!(this instanceof Named) && other instanceof Named) {
      return this.canAssignFrom(other.type);
    }
    return this.canAssignFromImpl(other);
  }

  equals(other: Type): boolean {
    return this.canAssignFrom(other) && other.canAssignFrom(this);
  }
}

export class Union extends Type {
  constructor(public types: TypeSet) {
    super();
  }

  toString(): string {
    if (this.isNever()) {
      return `Never`;
    }
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
}

export class Intersection extends Type {
  constructor(public types: TypeSet) {
    super();
  }

  toString(): string {
    if (this.types.size === 0) {
      return `Any`;
    }
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
}

export class Open extends Type {
  constructor(public type: Type) {
    super();
  }

  toString(): string {
    if (this.type.isNever()) {
      return `Any`;
    }
    return `${this.type}+`;
  }

  canAssignFromImpl(_other: Type): boolean {
    return true; // open is ...nuts? and accepts anything...
  }

  isNever(): boolean {
    return false;
  }
}

export class Named extends Type {
  constructor(public name: string, public type: Type) {
    super();
  }

  toString(): string {
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
}

export class Product extends Type {
  constructor(public types: Type[]) {
    super();
  }

  toString(): string {
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
}
