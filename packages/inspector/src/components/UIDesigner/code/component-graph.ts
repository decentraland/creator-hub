// Component reference graph — the cycle guard for nesting one root inside
// another. react-ecs composes components by rendering them, so a reference cycle
// (A renders B, B renders A) infinite-recurses at runtime. Before inserting
// `<Child />` into a root we check the edge wouldn't close a cycle. Pure: the
// store builds the `refs` map by parsing each root (IO) and feeds it here.

interface AstNode {
  type: string;
  [k: string]: any;
}

// The (capitalized) name of a JSX element, or null for a member-expression name
// (`<Foo.Bar />`) which never denotes a local root.
function jsxName(el: AstNode): string | null {
  const n = el.openingElement?.name ?? el.name;
  return n?.type === 'JSXIdentifier' && typeof n.name === 'string' ? n.name : null;
}

// Walk a program's JSX and collect the names of referenced elements that are in
// `known` (other roots). Used to build one node's outgoing edges.
export function collectComponentRefNames(
  program: AstNode | undefined,
  known: Set<string>,
): string[] {
  const found = new Set<string>();
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const n of node) visit(n);
      return;
    }
    if (node.type === 'JSXElement') {
      const name = jsxName(node);
      if (name && known.has(name)) found.add(name);
    }
    for (const key in node) {
      if (key === 'type' || key === 'start' || key === 'end') continue;
      visit(node[key]);
    }
  };
  visit(node_body(program));
  return [...found];
}

function node_body(program: AstNode | undefined): unknown {
  return program?.body ?? program;
}

// Can `from` reach `to` following edges in `refs` (adjacency: name → names it
// references)? Includes `from === to` (a self-reference is a cycle too).
export function reaches(refs: Map<string, string[]>, from: string, to: string): boolean {
  if (from === to) return true;
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const cur = stack.pop() as string;
    if (cur === to) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const next of refs.get(cur) ?? []) stack.push(next);
  }
  return false;
}

// Would nesting `child` inside `parent` create a cycle? Nesting adds the edge
// parent → child, so it's unsafe iff `child` already reaches `parent`.
export function wouldCycle(refs: Map<string, string[]>, parent: string, child: string): boolean {
  return reaches(refs, child, parent);
}
