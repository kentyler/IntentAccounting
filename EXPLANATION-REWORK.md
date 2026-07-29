# Intent Accounting explanation rework

## Purpose

The public surface now serves two audiences at once:

1. a human who needs a readable introduction before encountering the ledger; and
2. an LLM that needs a stable, self-contained source from which to explain, compare, criticize, or discuss Intent Accounting.

## Reading surfaces

- `public/index.html` is the explanatory front door.
- `public/llm-context.html` is the preferred single page to give an LLM.
- `public/books.html` is the generated live journal index.
- Account, posting, and board pages remain generated evidence behind the explanation.

## Explanation pages

- `why-intent-accounting.html`
- `how-the-books-work.html`
- `doctrines.html`
- `humans-and-llms.html`
- `worked-example.html`
- `questions-and-status.html`
- `llm-context.html`

All use `public/explanation.css` and deliberately mark the status of claims: doctrine, current implementation, explanatory interpretation, or proposal.

## Maintenance rule

`node generate-site.js` writes `public/books.html`; it must not overwrite `public/index.html`.

After changing the journal:

```bash
node generate-site.js
python verify-2.py journal.jsonl
```

After changing explanatory prose, no generation step is required.

## Validation performed

- `python verify-2.py journal.jsonl` — 108 postings conform.
- `node test/capture-test.js` — passed.
- `node test/boards-test.js` — passed.
- Local link audit across every HTML file in `public/` — no missing relative targets.

The Express server smoke test was not run in the working container because `node_modules` was not installed there. The static pages and generator do not depend on Express.
