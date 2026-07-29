# Public reading surfaces

This directory contains two surfaces with different jobs.

## Explanation

Hand-maintained files:

- `index.html` — human front door
- `why-intent-accounting.html`
- `how-the-books-work.html`
- `doctrines.html`
- `humans-and-llms.html`
- `worked-example.html`
- `questions-and-status.html`
- `llm-context.html` — self-contained page to give an LLM
- `explanation.css`
- `llms.txt`

These pages interpret the project. They do not amend the books and should say clearly when material is doctrine, current implementation, or proposal.

## Live books

Generated files:

- `books.html`
- `boards.html`
- `account-*.html`
- `posting-*.html`

Regenerate these from `journal.jsonl` with:

```bash
node generate-site.js
```

`generate-site.js` intentionally writes `books.html`, not `index.html`. Do not restore the old behavior: the explanation is the public front door, and the books are the evidence behind it.
