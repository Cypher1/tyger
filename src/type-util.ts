import {Any, Type, Refined, Var, Intersection, Union, Product, Named, Func, App} from './type.js';

export function churchT(): Type {
  return new Func(any(), new Func(any(), new Var(1, 't')));
}

export function churchF(): Type {
  return new Func(any(), new Func(any(), new Var(0, 'f')));
}

export function churchNat(n: number): Type {
  const f = new Var(1, 'f');
  const x = new Var(0, 'x');
  let curr: Type = x;
  while (n > 0) {
    n -= 1;
    curr = new App(f, curr);
  }
  return new Func(any(), new Func(any(), curr));
}

export function all(...conds: Type[]): Type {
  let cond = churchT();
  return new Refined(any(), cond);
}

export function intersection(...types: Type[]): Type {
  return new Intersection(new Set(types));
}

export function union(...types: Type[]): Type {
  return new Union(new Set(types));
}

export function product(...types: Type[]): Type {
  return new Product(types);
}

export function never(): Type {
  return union();
}

export function any(): Type {
  return new Any();
}

export function unit(): Type {
  return product();
}

export function undefined_type(): Type {
  return named('undefined', unit());
}

export function null_type(): Type {
  return named('null', unit());
}

export function named(name: string, type: Type): Type {
  return new Named(name, type);
}

export function func(argument: Type, result: Type): Type {
  return new Func(argument, result);
}

export function app(inner: Type, argument: Type): Type {
  return new App(inner, argument);
}

export function varT(id: number, name: string): Type {
  return new Var(id, name);
}
