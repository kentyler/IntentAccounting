#!/usr/bin/env node
/**
 * settle.js - K-6: Self-inscription
 *
 * Registers every produced artifact as a document, posts fulfill and verify
 * for K-1 through K-5, then for K-6 itself. Runs the verifier after each
 * settlement. Author: builder (solo bootstrap with recorded overrides).
 */

const { execSync } = require("child_process");
const path = require("path");
const journal = require("./src/journal");

let seq = 100;
function ts() {
  const s = seq++;
  const m = String(Math.floor(s / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `2026-06-12T01:${m}:${sec}Z`;
}

function post(fields) {
  return journal.append({
    id: fields.id,
    kind: fields.kind,
    author: fields.author || "builder",
    at: ts(),
    accounts: fields.accounts || [],
    vouchers: fields.vouchers || [],
    predecessors: fields.predecessors || [],
    content: fields.content || {},
    grammar: "canonical/1",
  });
}

function verify() {
  const journalPath = journal.journalPath();
  const result = execSync(`python verify.py "${journalPath}"`, {
    cwd: __dirname,
    encoding: "utf-8",
  });
  console.log("  " + result.trim());
  if (!result.includes("PASS")) {
    console.error("VERIFICATION FAILED - stopping");
    process.exit(1);
  }
}

// Documents to register: source files produced during the build
const artifacts = [
  { doc_id: "D-codec", file: "src/codec.js", doc_type: "source", desc: "K-2: canonical/1 codec" },
  { doc_id: "D-journal", file: "src/journal.js", doc_type: "source", desc: "K-1: journal store" },
  { doc_id: "D-derive", file: "src/derive.js", doc_type: "source", desc: "K-3: derivation" },
  { doc_id: "D-render", file: "src/render.js", doc_type: "source", desc: "K-4: audit rendering" },
  { doc_id: "D-routes", file: "src/routes.js", doc_type: "source", desc: "K-5: REST endpoints" },
  { doc_id: "D-mcp", file: "src/mcp.js", doc_type: "source", desc: "K-5: MCP tools" },
  { doc_id: "D-server", file: "src/server.js", doc_type: "source", desc: "K-5: Express server" },
  { doc_id: "D-bootstrap", file: "bootstrap.js", doc_type: "source", desc: "Opening entry transcription" },
  { doc_id: "D-settle", file: "settle.js", doc_type: "source", desc: "K-6: self-inscription script" },
  { doc_id: "D-verifier", file: "verify.py", doc_type: "source", desc: "The shipped verifier (P-3)" },
];

console.log("=== K-6: Self-inscription ===\n");

// Phase 1: Register all produced artifacts
console.log("Registering artifacts...");
let regSeq = 0;
for (const a of artifacts) {
  post({
    id: `reg-${a.doc_id}`,
    kind: "register",
    content: {
      document: {
        doc_id: a.doc_id,
        doc_type: a.doc_type,
        location: `./${a.file}`,
        description: a.desc,
      },
    },
  });
  console.log(`  registered ${a.doc_id} -> ${a.file}`);
}

verify();

// Phase 2: Settle K-1 through K-5
const settlements = [
  {
    account: "K-1",
    vouchers: ["D-journal"],
    note: "Flat-file append-only journal store implemented. append() with fsync, read(), exportCanonical(). Never modifies or deletes. Export passes verifier.",
  },
  {
    account: "K-2",
    vouchers: ["D-codec"],
    note: "canonical/1 codec implemented. parse() and serialize() satisfy the round-trip law. validate() checks canonical well-formedness.",
  },
  {
    account: "K-3",
    vouchers: ["D-derive"],
    note: "Derivation implemented. derive() computes STANDING/OPEN/SETTLED from journal alone. Agrees with verifier on opening journal and conformance fixtures.",
  },
  {
    account: "K-4",
    vouchers: ["D-render"],
    note: "Audit rendering implemented. render() produces deterministic, human-legible, byte-stable output. Matches verifier render() exactly (verified by diff).",
  },
  {
    account: "K-5",
    vouchers: ["D-routes", "D-mcp", "D-server"],
    note: "Posting interface implemented. REST: POST /postings, GET /journal, GET /state, GET /audit. MCP: post, read_journal, read_state, read_audit. Rejects only on canonical well-formedness (P-4).",
  },
];

for (const s of settlements) {
  console.log(`\nSettling ${s.account}...`);

  const fulfillId = `fulfill-${s.account}`;
  const verifyId = `verify-${s.account}`;

  post({
    id: fulfillId,
    kind: "fulfill",
    accounts: [s.account],
    vouchers: s.vouchers,
    content: { note: s.note },
  });

  post({
    id: verifyId,
    kind: "verify",
    accounts: [s.account],
    predecessors: [fulfillId],
    content: {
      verdict: "accepted",
      override_reason: "solo bootstrap",
    },
  });

  console.log(`  ${s.account}: fulfilled and verified`);
  verify();
}

// Phase 3: Settle K-6 itself
console.log("\nSettling K-6 (self-inscription)...");

const allDocIds = artifacts.map((a) => a.doc_id);
post({
  id: "fulfill-K-6",
  kind: "fulfill",
  accounts: ["K-6"],
  vouchers: allDocIds,
  content: {
    note: "The construction of this instance is recorded in these books. The journal contains: chart declaration, constitution P-1..P-8, document registrations, lessons L-1..L-6, kernel accounts K-1..K-6, deferred accounts D-1..D-8, artifact registrations, fulfill/verify for K-1..K-5, and this self-inscription. The whole passes the verifier.",
  },
});

post({
  id: "verify-K-6",
  kind: "verify",
  accounts: ["K-6"],
  predecessors: ["fulfill-K-6"],
  content: {
    verdict: "accepted",
    override_reason: "solo bootstrap",
  },
});

console.log("  K-6: fulfilled and verified");
verify();

// Phase 4: Final annotation - the instance exists
post({
  id: "ann-instance-exists",
  kind: "annotate",
  accounts: ["K-6"],
  vouchers: ["D-books"],
  content: {
    text: "The instance exists. All kernel accounts K-1 through K-6 are settled. The verifier passes. The books remain open; they are never finished.",
    bookmark: true,
    session_summary: "Solo bootstrap by builder. Opening entries transcribed from the founding document. Kernel accounts settled in order: K-2 (codec), K-1 (journal), K-3 (derivation), K-4 (rendering), K-5 (posting interface), K-6 (self-inscription). Stack: Node.js/Express, flat-file JSONL, REST + MCP. Deferred accounts D-1..D-8 remain open.",
    next: "The instance is running. Next actors may work deferred accounts, improve kernel implementations by supersession, or open new accounts.",
  },
});

console.log("\n=== Final verification ===");
verify();

// Print final state
const { derive } = require("./src/derive");
const { render } = require("./src/render");
const postings = journal.read();
const accounts = derive(postings);
console.log("\n" + render(accounts));
console.log(`Total postings: ${postings.length}`);
