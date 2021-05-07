export abstract class Type {

  abstract toString(): string;
  abstract canAssignFrom(other: Type): boolean;

  equals(other: Type): boolean {
    return this.canAssignFrom(other) && other.canAssignFrom(this);
  }

  isNever(): boolean {
    return false;
  }
}

export class Union extends Type {
  constructor(public types: Type[]) {
    super();
  }

  toString(): string {
    if (this.isNever()) {
      return `Never`;
    }
    return `(${this.types.map(x => x.toString()).join('|')})`;
  }

  canAssignFrom(other: Type): boolean {
    for (var type of this.types) {
      if (type.canAssignFrom(other)) {
        return true; // `other` can be stored in `type`
      }
    }
    return false;
  }

  isNever(): boolean {
    return this.types.length === 0;
  }
}

export class Intersection extends Type {
  constructor(public types: Type[]) {
    super();
  }

  toString(): string {
    if (this.types.length === 0) {
      return `Unit`;
    }
    return `(${this.types.map(x => x.toString()).join('&')})`;
  }

  canAssignFrom(other: Type): boolean {
    for (var type of this.types) {
      if (!type.canAssignFrom(other)) {
        return false; // other must match all requirements
      }
    }
    return true;
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

  canAssignFrom(_other: Type): boolean {
    return true; // open is ...nuts? and accepts anything...
  }
}
/*
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
}*/
