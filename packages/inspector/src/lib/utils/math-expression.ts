/**
 * Safely evaluates a simple arithmetic expression string.
 * Supports +, -, *, / operators and parentheses. No eval.
 * Returns null if the expression is not a valid complete arithmetic expression.
 */
export function evaluateMathExpression(expr: string): number | null {
  const s = expr.replace(/\s+/g, '');
  if (!s) return null;
  // Only allow digits, decimal points, operators, and parentheses
  if (!/^[0-9+\-*/.()]+$/.test(s)) return null;
  // Must contain at least one operator beyond a possible leading minus
  if (!/[+*/]/.test(s) && !/\d-/.test(s)) return null;

  let pos = 0;

  function peek(): string {
    return s[pos] ?? '';
  }
  function consume(): string {
    return s[pos++];
  }

  function parseExpr(): number {
    let left = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseUnary();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parseUnary();
      if (op === '/' && right === 0) throw new Error('Division by zero');
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  function parseUnary(): number {
    if (peek() === '-') {
      consume();
      return -parsePrimary();
    }
    if (peek() === '+') {
      consume();
      return parsePrimary();
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    if (peek() === '(') {
      consume();
      const val = parseExpr();
      if (peek() !== ')') throw new Error('Expected )');
      consume();
      return val;
    }
    const start = pos;
    while (/[0-9.]/.test(peek())) consume();
    const numStr = s.slice(start, pos);
    if (!numStr) throw new Error('Expected number at pos ' + pos);
    const num = parseFloat(numStr);
    if (isNaN(num)) throw new Error('Invalid number: ' + numStr);
    return num;
  }

  try {
    const result = parseExpr();
    if (pos !== s.length) return null; // didn't consume all input
    return isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

/**
 * Returns true if the string looks like it contains arithmetic operators
 * (beyond a simple leading minus for negative numbers).
 */
export function containsMathOperators(value: string): boolean {
  return /[+*/]/.test(value) || /\d-/.test(value);
}
