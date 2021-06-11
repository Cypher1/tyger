import {Any, Type, Refined, Var, Intersection, Union, Product, Named, Func, App} from './type.js';

export function withArgs(inner: Type, ...types: Type[]): Type {
  let curr = inner;
  for (const ty of types) {
    curr = new Func(ty, curr);
  }
  return curr;
}

export function churchBool(b: boolean): Type {
  if (b) {
    return churchT();
  } else {
    return churchF();
  }
}

export function churchT(): Type {
  return withArgs(new Var(1, 't'), any(), any());
}

export function churchF(): Type {
  return withArgs(new Var(0, 'f'), any(), any());
}

export function churchNat(n: number): Type {
  const f = new Var(1, 'f');
  const x = new Var(0, 'x');
  let curr: Type = x;
  while (n > 0) {
    n -= 1;
    curr = new App(f, curr);
  }
  return withArgs(curr, any(), any());
}

export function churchPlus(): Type {
  const n = new Var(3, 'n');
  const m = new Var(2, 'm');
  const f = new Var(1, 'f');
  const x = new Var(0, 'x');
  return withArgs(app(app(n, f), app(app(m, f), x)), any(), any(), any(), any());
}

export function churchAnd(): Type {
  const a = new Var(3, 'a');
  const b = new Var(2, 'b');
  const t = new Var(1, 't');
  const f = new Var(0, 'f');
  return withArgs(app(app(a, app(app(b, t), f)), f), any(), any(), any(), any());
}

// export function all(...conds: Type[]): Type {
  // let cond = churchT();
  // return new Refined(any(), cond);
// }

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

export function applyAll(inner: Type, ...args: Type[]): Type {
  let curr = inner;
  for (const arg of args) {
    curr = app(curr, arg);
  }
  return curr;
}

export function app(inner: Type, argument: Type): Type {
  return new App(inner, argument);
}

export function varT(id: number, name: string): Type {
  return new Var(id, name);
}
