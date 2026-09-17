interface AstLike {
  type: string;
  [k: string]: any;
}

/** Unwrap any `ParenthesizedExpression` layers, returning the inner node. */
export function unparen<T extends AstLike>(node: T): T {
  let n: AstLike = node;
  while (n && n.type === 'ParenthesizedExpression') n = n.expression;
  return n as T;
}

/** The property name of an object/JSX key node: the identifier name, else its stringified literal value. */
export function keyName(key: AstLike): string {
  return key.type === 'Identifier' ? key.name : String(key.value);
}
