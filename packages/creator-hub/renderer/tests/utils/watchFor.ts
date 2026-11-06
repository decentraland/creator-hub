type Match = string | ((element: Element) => boolean);

const withOldText = (record: MutationRecord) => {
  const text = record.target;
  const parent = text.parentElement;
  if (!parent) return null;
  const clone = parent.cloneNode(true) as Element;
  const index = [...parent.childNodes].indexOf(text as ChildNode);
  clone.childNodes[index].nodeValue = record.oldValue;
  return clone;
};

/**
 * Records whether an element matching `match` was ever on the page, however briefly, including
 * one React rendered and replaced, or retexted, inside a single `act`.
 * @param match - a CSS selector, or a predicate run on every element added, removed or retexted.
 */
export function watchFor(match: Match) {
  const test = typeof match === 'string' ? (element: Element) => element.matches(match) : match;
  const holds = (root: Element) => test(root) || [...root.querySelectorAll('*')].some(test);
  let seen = holds(document.body);
  const record = (records: MutationRecord[]) => {
    for (const entry of records) {
      const nodes =
        entry.type === 'characterData'
          ? [withOldText(entry)]
          : [...entry.addedNodes, ...entry.removedNodes];
      for (const node of nodes) {
        if (node instanceof Element && holds(node)) seen = true;
      }
    }
  };
  const observer = new MutationObserver(record);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    characterDataOldValue: true,
  });
  return {
    seen: () => {
      record(observer.takeRecords());
      return seen;
    },
    stop: () => observer.disconnect(),
  };
}
