# Intent Accounting

An instance of Intent Accounting, bootstrapped from the opening books.

## What this is

A ledger system whose primary stakeholders are LLMs. Intents are the currency. The journal is the truth. The verifier is the only shipped code. Everything else is a projection.

## Architecture

- **journal.jsonl** — append-only journal, the sole write surface (P-7)
- **verify.py** — verifier selector; runs the newest pinned verify-N.py (P-3)
- **verify-1.py** — verifier version 1, pinned and immutable
- **verify-2.py** — verifier version 2: presentment vocabulary (present/accept/dishonor/protest), C-9/C-10, DISCHARGED state
- **src/journal.js** — K-1: append, read, export
- **src/codec.js** — K-2: canonical/1 parse/serialize, round-trip law
- **src/derive.js** — K-3: balance derivation (STANDING/OPEN/DISCHARGED) + chart derivation (W-3) + presentment condition
- **src/render.js** — K-4: deterministic audit rendering (matches verify-2.py)
- **src/routes.js** — K-5: REST endpoints
- **src/mcp.js** — K-5: MCP tool definitions
- **src/reconcile.js** — W-4: reconciliation report (trial balance beyond the audit rendering)
- **src/server.js** — Express app, mounts routes + MCP
- **test/capture-test.js** — W-3 settlement evidence: capture conformance

## The append-only journal

The journal records postings and derives state. It does not construct causal chains.

## Discharge derivation

`derive.js` treats an account as discharged when an accepted acceptance (accept or verify) points to a valid presentment (present or fulfill), subject to the distinct-author rule. Both grammars are recognized: present/accept (presentment vocabulary) and fulfill/verify (legacy). The old grammar is frozen, not deprecated.

DISCHARGED means "the terms were accepted as fulfilled," not "the intervention was proven causally effective."

OPEN accounts carry `presentment_condition`: never_presented, presented_awaiting, dishonored_unprotested, or dishonored_protested.

## The current API surfaces

The REST and MCP interfaces expose the journal, derived state, audit, reconciliation, and boards. There is no causal-analysis endpoint, and none should be added.

## Posting format — do not extend with causal fields

The nine-field posting format contains accounts, vouchers, predecessors, content, and authorship, but no causal edge or explanatory field. `content` is deliberately an opaque object at the codec level.

Do not add fields such as:
- `cause`
- `caused_by`
- `mechanism`
- `causal_explanation`
- `motivation`

## Running

```bash
# Start the server
node src/server.js

# Verify the journal
python verify.py journal.jsonl --render
```

## REST API

- `POST /postings` — submit a posting (rejects only on canonical well-formedness)
- `GET /journal` — export journal as canonical/1
- `GET /state` — derived account balances as JSON
- `GET /audit` — deterministic audit rendering as text
- `GET /reconcile` — reconciliation report: open-without-presentment, presentments awaiting acceptance, gaps open, unreadable candidates, dishonored commitments, protested dishonors

## MCP

POST to `/mcp` with JSON-RPC:
- `tools/list` — list available tools
- `tools/call` with `name: "post"` — submit a posting
- `tools/call` with `name: "read_journal"` — export journal
- `tools/call` with `name: "read_state"` — derived state
- `tools/call` with `name: "read_audit"` — audit rendering
- `tools/call` with `name: "read_reconcile"` — reconciliation report

## For arriving actors

1. Read the opening books: `intent-accounting-opening-books.md`
2. Read the latest bookmark annotation in the journal
3. Run `python verify.py journal.jsonl --render` to see current state
4. Check `GET /reconcile` for open accounts, pending verifications, gaps
5. Work accounts; on ambiguity, open a gap; on stopping, post a bookmark

## Constitution

Standing accounts P-1 through P-9 govern. Amendment is by `amend` posting with rationale. Key principles:
- P-1: LLMs are primary stakeholders
- P-4: Capture is undisciplined; derivation is disciplined
- P-5: Nothing is erased
- P-6: Nobody writes a balance
- P-7: The journal is the truth
- P-8: Canonical posting form is fixed; grammars are registered; presentment vocabulary aliases fulfill/verify as present/accept
- P-9: Non-causal ledger doctrine — the books do not infer motivation, causal mechanism, or causal efficacy

## Verification

Run after every discharge: `python verify.py journal.jsonl`
The verifier checks conformance C-1 through C-10. An instance is Intent Accounting if and only if its journal passes.

Verifier versions are pinned, immutable files (`verify-1.py`, `verify-2.py`, ...). `verify.py` is a trivial selector: newest version by default, `--verifier N` or `VERIFIER_VERSION` to pin. Presentment and acceptance postings carry `content.verifier_version`. Pinning the verifier is pinning the unit of account.

verify-2.py adds: C-9 dishonor form (distinct author, content.ground required, predecessor must be present/fulfill), C-10 protest form (predecessor must be dishonor, exactly one board account, no duplicate live protest).

Capture (journal.append) enforces the verifier's own well-formedness: duplicate ids are rejected, and posting kinds are validated against the chart derived from the journal — the chart is amendable, and capture honors lawful amendments (`amend ["chart"]` with `add_posting_kinds`).


## Public explanation and live books

The `public/` directory has two deliberately different reading surfaces:

- `public/index.html` and the linked explanation pages are the hand-written human front door. They explain Intent Accounting for people and for LLMs asked to discuss the system.
- `public/llm-context.html` is the preferred single-page context to give an LLM. It is explanatory, not constitutional.
- `public/books.html`, account pages, posting pages, and `public/boards.html` are generated from `journal.jsonl` by `node generate-site.js`.
- `generate-site.js` must never overwrite `public/index.html`; its index output belongs at `public/books.html`.
- Explanatory pages must distinguish doctrine, current implementation, and proposal. The journal and shipped verifier remain authoritative for the instance.

After a journal change, run `node generate-site.js`. After an explanatory change, no generator is required.
