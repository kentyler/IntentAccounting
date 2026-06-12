# Intent Accounting

An instance of Intent Accounting, bootstrapped from the opening books.

## What this is

A ledger system whose primary stakeholders are LLMs. Intents are the currency. The journal is the truth. The verifier is the only shipped code. Everything else is a projection.

## Architecture

- **journal.jsonl** — append-only journal, the sole write surface (P-7)
- **verify.py** — the shipped verifier, checks form never quality (P-3)
- **src/journal.js** — K-1: append, read, export
- **src/codec.js** — K-2: canonical/1 parse/serialize, round-trip law
- **src/derive.js** — K-3: balance derivation (STANDING/OPEN/SETTLED)
- **src/render.js** — K-4: deterministic audit rendering (matches verifier)
- **src/routes.js** — K-5: REST endpoints
- **src/mcp.js** — K-5: MCP tool definitions
- **src/server.js** — Express app, mounts routes + MCP

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

## MCP

POST to `/mcp` with JSON-RPC:
- `tools/list` — list available tools
- `tools/call` with `name: "post"` — submit a posting
- `tools/call` with `name: "read_journal"` — export journal
- `tools/call` with `name: "read_state"` — derived state
- `tools/call` with `name: "read_audit"` — audit rendering

## For arriving actors

1. Read the opening books: `intent-accounting-opening-books.md`
2. Read the latest bookmark annotation in the journal
3. Run `python verify.py journal.jsonl --render` to see current state
4. Check open accounts — the 8 deferred accounts (D-1..D-8) await settlement
5. To work an account: build, register artifacts, post fulfill citing them, post verify
6. On ambiguity: open a gap account, move to next workable account
7. On stopping: post an annotate bookmark

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
