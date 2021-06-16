import {Any, Type, Refined, Fallback, Never, Var, Intersection, makeUnion, Product, Named, Func, App} from './type.js';

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

function vars(...names: string[]): Type[] {
  let args = [];
  let id = 0;
  for (const name of names) {
    args.push(new Var(id, name));
    id += 1;
  }
  return args;
}

export function churchPlus(): Type {
  const [x, f, m, n] = vars('x', 'f', 'm', 'n');
  return withArgs(app(app(n, f), app(app(m, f), x)), any(), any(), any(), any());
}

export function churchNot(): Type {
  const [f, t, a] = vars('f', 't', 'a');
  return withArgs(app(app(a, f), t), any(), any(), any());
}

export function churchOr(): Type {
  const [f, t, b, a] = vars('f', 't', 'b', 'a');
  return withArgs(app(app(a, t), app(app(b, t), f)), any(), any(), any(), any());
}

export function churchAnd(): Type {
  const [f, t, b, a] = vars('f', 't', 'b', 'a');
  return withArgs(app(app(a, app(app(b, t), f)), f), any(), any(), any(), any());
}

export function requireType(): Type {
  const [v, t] = vars('v', 't');
  return withArgs(app(new Func(t, v), v), any(), any());
}

export function fallback(): Type {
  const [def, ty] = vars('def', 'ty');
  return withArgs(new Fallback(ty, def), any(), any());
}

export function isType(): Type {
  const [v, t] = vars('v', 't');
  return withArgs(app(app(fallback(), app(new Func(t, churchT()), v)), churchF()), any(), any());
}

export function all(...conds: Type[]): Type {
  let curr = churchT();
  for (const cond of conds) {
    curr = app(app(churchOr(), curr), cond);
  }
  return new Refined(any(), curr);
}

export function intersection(...types: Type[]): Type {
  return new Intersection(new Set(types));
}

export function union(...types: Type[]): Type {
  return makeUnion(new Set(types));
}

export function product(...types: Type[]): Type {
  return new Product(types);
}

export function never(): Type {
  // return union();
  return new Never();
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
