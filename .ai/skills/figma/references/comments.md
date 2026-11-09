# Figma comments: harvest, ledger, mapping

Use this when the work starts from a designer's Figma comments ("the designer left comments, focus on the ones that tag me") instead of from a frame. A comment is a change request about a node; it is not a value. The pass is done when every matching thread is in the ledger, so the next pass is a diff, not a fresh hunt.

## Harvest every thread, replies included

- **Email links.** A `figma.com/email/link_redirect?…` URL from a notification opens the file in the browser; use the URL it lands on (file key, page, comment) and ignore the redirect.
- **Read the whole list in one call.** In a signed-in Figma tab of that file, a same-origin fetch returns every comment on the file, so no MCP call is spent and no pin is clicked:

  ```js
  const r = await fetch('/api/file/<fileKey>/comments', { credentials: 'include' });
  const all = (await r.json()).meta.filter(c => !c.deleted_at);
  window.__comments = all;
  `${r.status} n=${all.length}`;
  ```

  Keep the array on `window` and filter it in later synchronous snippets ([`browser-extraction.md`](browser-extraction.md) has the CDP timeout).

- **Fields.** `id`, `parent_id` (set on a reply), `resolved_at`, `created_at`, `user.handle`, `client_meta.node_id` (the node the pin sits on; a reply has none, so take it from its root), and `message_meta`, a list of parts: `{ t }` for text and `{ user_annotated: { handle } }` for a mention.
- **Match on replies too.** A mention or a request often sits in a reply, not in the thread's first comment, so filtering only roots misses some. Select every comment by the author (or that mentions the user), then map each match to its root thread (`parent_id`) and dedupe. Record the total thread count and the open count before you read a single one, and give both to the lead.

## The ledger

One row per thread, in the spec's §0, before any value is read:

| # | Thread `id` | Node | Author · date | Request (verbatim, original language) | Open / resolved | What it changes (node · property · Figma's current value) | Action |
| --- | --- | --- | --- | --- | --- | --- | --- |

- **Map each request to a node, a property and Figma's current value.** Comment wording is loose: "the stroke at 5%" turned out to describe the row fill, while the board drew both strokes at 10%, and "a gradient in the rows" was the page showing through a 5% fill. Write what Figma draws now next to what the comment asks for.
- **A comment that contradicts the board is a question for the user.** Recommend the board's value unless the comment's author owns that board. Record the answer as a ✱ row in `docs/DESIGN.md` ("user decision; `<node>` draws X, until the board is updated").
- **A comment the code already satisfies** is a row whose action is "none: already matches", with the evidence, so the next pass doesn't reopen it.
- **The next pass diffs, it doesn't re-hunt.** Fetch again and compare thread ids and `resolved_at` with the ledger: new threads, newly resolved ones and new replies are the only work.
