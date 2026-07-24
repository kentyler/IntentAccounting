#!/usr/bin/env node
/**
 * v2-amend.js - Phase C & D: Boards and Authority amendments
 *
 * Appends the two constitutional amendments from the v2 build instructions:
 *   Phase C: board account kind + BD-1, BD-2 doctrine
 *   Phase D: grant/revoke posting kinds + authority account + AU-1..AU-5
 *
 * All postings authored by "founder". Runs the verifier after each phase.
 * Pattern follows settle.js.
 */

const { execSync } = require("child_process");
const path = require("path");
const journal = require("./src/journal");

let seq = 0;
function ts() {
  const s = seq++;
  const m = String(Math.floor(s / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `2026-07-24T18:${m}:${sec}Z`;
}

function post(fields) {
  return journal.append({
    id: fields.id,
    kind: fields.kind,
    author: fields.author || "founder",
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
  const result = execSync(`python verify-1.py "${journalPath}"`, {
    cwd: __dirname,
    encoding: "utf-8",
  });
  console.log("  " + result.trim());
  if (!result.includes("PASS")) {
    console.error("VERIFICATION FAILED - stopping");
    process.exit(1);
  }
}

// ============================================================
// Phase C: Boards amendment (3 postings)
// ============================================================
console.log("=== Phase C: Boards amendment ===\n");

// 1. Amend chart to add board account kind
post({
  id: "amend-chart-boards",
  kind: "amend",
  accounts: ["chart"],
  predecessors: ["p1"],
  content: {
    add_account_kinds: ["board"],
    rationale: "Constitutional amendment: boards enter the chart as a new account kind. A board is a named region of the books -- a cluster of accounts forming one conversation -- and the unit of locality for the counterpart's manner of counsel. The board kind is declared now; actual boards are opened in operation, after the instance is claimed.",
  },
});
console.log("  amend-chart-boards: board account kind added to chart");

// 2. Open BD-1: board crystallization doctrine
post({
  id: "open-BD-1",
  kind: "open",
  accounts: ["BD-1"],
  content: {
    account_kind: "commitment",
    terms: "Board crystallization: the instance proposes candidate boards from structural connectivity (accounts sharing vouchers, citing one another, linked by contested readings); no board exists until a human confirms by recognition; proposals are rationed; each board renders its own view.",
  },
});
console.log("  open-BD-1: board crystallization doctrine");

// 3. Open BD-2: board-local stance doctrine
post({
  id: "open-BD-2",
  kind: "open",
  accounts: ["BD-2"],
  content: {
    account_kind: "commitment",
    terms: "Board-local stance: a stance is an annotate on a board carrying content.stance with read/register/initiative from fixed vocabularies; stances accrete (latest current, no stored scores); the advisor owns the read, the owner commands register and initiative; behavior follows current stance; on person-centred boards a stance cites events, never characterizes the person; the trail lets a new model continue the posture without retraining.",
  },
});
console.log("  open-BD-2: board-local stance doctrine");

console.log("\nVerifying after Phase C...");
verify();

// ============================================================
// Phase D: Authority amendment (8 postings)
// ============================================================
console.log("\n=== Phase D: Authority amendment ===\n");

// 4. Amend chart to add grant/revoke posting kinds
post({
  id: "amend-chart-authority",
  kind: "amend",
  accounts: ["chart"],
  predecessors: ["p1"],
  content: {
    add_posting_kinds: ["grant", "revoke"],
    rationale: "Constitutional amendment: grant and revoke posting kinds enter the chart. These are the instruments of operational authority -- the chain of authorization from genesis forward. The verifier checks their form as generic kinds; their meaning and effect are computed by derivation, not the verifier.",
  },
});
console.log("  amend-chart-authority: grant/revoke posting kinds added");

// 5. Register v2 build instructions as D-authority
post({
  id: "reg-D-authority",
  kind: "register",
  content: {
    document: {
      doc_id: "D-authority",
      doc_type: "specification",
      location: "./intent-accounting-build-instructions-v2.md",
      description: "V2 build instructions: the authoritative specification for authority structures, boards, and the full cold-start sequence including Phases C and D.",
    },
  },
});
console.log("  reg-D-authority: v2 build instructions registered");

// 6. Open the authority account (standing commitment)
post({
  id: "open-authority",
  kind: "open",
  accounts: ["authority"],
  vouchers: ["D-authority"],
  content: {
    account_kind: "commitment",
    standing: true,
    terms: "The authority account: the ledger of grant and revoke postings and the chain of authorization from genesis forward.",
  },
});
console.log("  open-authority: authority account opened (standing)");

// 7. Open AU-1: immutability
post({
  id: "open-AU-1",
  kind: "open",
  accounts: ["AU-1"],
  vouchers: ["D-authority"],
  content: {
    account_kind: "commitment",
    terms: "Immutability: nothing written ever changes; authority changes only by new postings.",
  },
});
console.log("  open-AU-1: immutability doctrine");

// 8. Open AU-2: one genesis
post({
  id: "open-AU-2",
  kind: "open",
  accounts: ["AU-2"],
  vouchers: ["D-authority"],
  content: {
    account_kind: "commitment",
    terms: "One genesis: exactly one self-authorizing genesis grant, where author equals grantee, role owner, content.genesis true, no empowering predecessor.",
  },
});
console.log("  open-AU-2: one genesis doctrine");

// 9. Open AU-3: chain to genesis
post({
  id: "open-AU-3",
  kind: "open",
  accounts: ["AU-3"],
  vouchers: ["D-authority"],
  content: {
    account_kind: "commitment",
    terms: "Chain to genesis: every non-genesis grant or revoke is authored by an identity whose authority chains back to genesis and cites the empowering grant as predecessor.",
  },
});
console.log("  open-AU-3: chain to genesis doctrine");

// 10. Open AU-4: prospective only
post({
  id: "open-AU-4",
  kind: "open",
  accounts: ["AU-4"],
  vouchers: ["D-authority"],
  content: {
    account_kind: "commitment",
    terms: "Prospective only: an authority change never alters the effect of earlier entries; effect is derived by walking forward to each posting's position.",
  },
});
console.log("  open-AU-4: prospective only doctrine");

// 11. Open AU-5: author rule / owner policy
post({
  id: "open-AU-5",
  kind: "open",
  accounts: ["AU-5"],
  vouchers: ["D-authority"],
  content: {
    account_kind: "commitment",
    terms: "The author rule is kernel law (settlement needs distinct fulfiller and verifier); above the floor, succession shape, role definitions, and revocation rules are owner-set recorded policy, and a policy change is a top-level act governed by the currently-effective policy.",
  },
});
console.log("  open-AU-5: author rule / owner policy doctrine");

console.log("\nVerifying after Phase D...");
verify();

// Print final state
const { derive } = require("./src/derive");
const { render } = require("./src/render");
const postings = journal.read();
const accounts = derive(postings);
console.log("\n" + render(accounts));
console.log(`Total postings: ${postings.length}`);
