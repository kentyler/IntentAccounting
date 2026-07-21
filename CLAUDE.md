# Intent Accounting

An instance of Intent Accounting, bootstrapped from the opening books.

## What this is

A ledger system whose primary stakeholders are LLMs. Intents are the currency. The journal is the truth. The verifier is the only shipped code. Everything else is a projection.

## Architecture

- **journal.jsonl** — append-only journal, the sole write surface (P-7)
- **verify.py** — verifier selector; runs the newest pinned verify-N.py (P-3)
- **verify-1.py** — verifier version 1, pinned and immutable; amendment ships verify-2.py beside it
- **src/journal.js** — K-1: append, read, export
- **src/codec.js** — K-2: canonical/1 parse/serialize, round-trip law
- **src/derive.js** — K-3: balance derivation (STANDING/OPEN/SETTLED) + chart derivation (W-3)
- **src/render.js** — K-4: deterministic audit rendering (matches verifier)
- **src/routes.js** — K-5: REST endpoints
- **src/mcp.js** — K-5: MCP tool definitions
- **src/reconcile.js** — W-4: reconciliation report (trial balance beyond the audit rendering)
- **src/server.js** — Express app, mounts routes + MCP
- **test/capture-test.js** — W-3 settlement evidence: capture conformance

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
- `GET /reconcile` — reconciliation report: open-without-fulfill, fulfills awaiting distinct-author verify, gaps open, unreadable candidates

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

Standing accounts P-1 through P-8 govern. Amendment is by `amend` posting with rationale. Key principles:
- P-1: LLMs are primary stakeholders
- P-4: Capture is undisciplined; derivation is disciplined
- P-5: Nothing is erased
- P-6: Nobody writes a balance
- P-7: The journal is the truth

## Verification

Run after every settlement: `python verify.py journal.jsonl`
The verifier checks conformance C-1 through C-8. An instance is Intent Accounting if and only if its journal passes.

Verifier versions are pinned, immutable files (`verify-1.py`, ...). `verify.py` is a trivial selector: newest version by default, `--verifier N` or `VERIFIER_VERSION` to pin. Fulfill and verify postings carry `content.verifier_version`. Pinning the verifier is pinning the unit of account.

Capture (journal.append) enforces the verifier's own well-formedness: duplicate ids are rejected, and posting kinds are validated against the chart derived from the journal — the chart is amendable, and capture honors lawful amendments (`amend ["chart"]` with `add_posting_kinds`).
