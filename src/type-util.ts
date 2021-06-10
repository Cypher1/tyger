import {Type, Intersection, Union, Product, Named, Open, Func, App} from './type.js';

export function intersection(...types: Type[]) {
  return new Intersection(new Set(types));
}

export function union(...types: Type[]) {
  return new Union(new Set(types));
}

export function product(...types: Type[]) {
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

export function open(t: Type): Type {
  return new Open(t);
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

