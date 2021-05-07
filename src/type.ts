export abstract class Type {

  abstract toString(): string;
}

export class Union extends Type {
  constructor(public types: Type[]) {
    super();
  }

  toString(): string {
    if (this.types.length === 0) {
      return `Never`;
    }
    return `(${this.types.map(x => x.toString()).join('|')})`;
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
}
