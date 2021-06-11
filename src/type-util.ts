import {Type, Refined, Var, Intersection, Union, Product, Named, Func, App} from './type.js';

export function churchT(): Type {
  return new Func(any(), new Func(any(), new Var(0, 't')));
}

export function churchF(): Type {
  return new Func(any(), new Func(any(), new Var(1, 'f')));
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
  return intersection();
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
