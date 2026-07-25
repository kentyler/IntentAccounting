#!/usr/bin/env node
/**
 * Board derivation tests.
 *
 * Same pattern as capture-test.js: ok(cond, label) assertions,
 * exit code, standalone script. Tests build synthetic postings
 * in-memory and call derivation functions directly.
 *
 * Run: node test/boards-test.js
 */

const {
  deriveBoards,
  deriveBoardMemberships,
  deriveBoardStances,
  deriveBoardPremises,
  deriveCrossBoardExposures,
  deriveBoardDivergences,
} = require("../src/boards");
const { derive } = require("../src/derive");

let failures = 0;
function ok(cond, label) {
  console.log((cond ? "PASS" : "FAIL") + ": " + label);
  if (!cond) failures++;
}

function posting(overrides) {
  return Object.assign({
    author: "tester", at: "2026-07-01T00:00:00Z",
    accounts: [], vouchers: [], predecessors: [],
    content: {}, grammar: "canonical/1",
  }, overrides);
}

// --------------- fixtures ---------------

// Base postings: chart + two board accounts + two regular accounts
function basePostings() {
  return [
    posting({ id: "chart", kind: "open", accounts: ["chart"], content: {
      standing: true,
      account_kinds: ["commitment", "gap", "relation", "board"],
      posting_kinds: ["open", "register", "fulfill", "verify", "reverse", "amend", "annotate"],
    }}),
    posting({ id: "open-board-alpha", kind: "open", accounts: ["board-alpha"], content: {
      account_kind: "board", terms: "Alpha board for testing",
    }}),
    posting({ id: "open-board-beta", kind: "open", accounts: ["board-beta"], content: {
      account_kind: "board", terms: "Beta board for testing",
    }}),
    posting({ id: "open-acct-1", kind: "open", accounts: ["acct-1"], content: {
      account_kind: "commitment", terms: "Test account 1",
    }}),
    posting({ id: "open-acct-2", kind: "open", accounts: ["acct-2"], content: {
      account_kind: "commitment", terms: "Test account 2",
    }}),
  ];
}

function accts(postings) {
  return derive(postings);
}

// =============== MEMBERSHIP TESTS ===============
console.log("\n--- Membership ---");

{
  const pp = [...basePostings(),
    posting({ id: "mem-1", kind: "annotate", accounts: ["board-alpha"],
      content: { membership: { board: "board-alpha", member: "acct-1", action: "added" } } }),
  ];
  const accounts = accts(pp);
  const { memberships } = deriveBoardMemberships(pp, accounts);
  ok(memberships["board-alpha"].current.length === 1, "add: one member after add");
  ok(memberships["board-alpha"].current[0].member === "acct-1", "add: correct member id");
}

{
  const pp = [...basePostings(),
    posting({ id: "mem-1", kind: "annotate", accounts: ["board-alpha"],
      content: { membership: { board: "board-alpha", member: "acct-1", action: "added" } } }),
    posting({ id: "mem-2", kind: "annotate", accounts: ["board-alpha"],
      content: { membership: { board: "board-alpha", member: "acct-1", action: "removed" } } }),
  ];
  const accounts = accts(pp);
  const { memberships } = deriveBoardMemberships(pp, accounts);
  ok(memberships["board-alpha"].current.length === 0, "remove: member removed");
  ok(memberships["board-alpha"].removed.length === 1, "remove: appears in removed list");
}

{
  const pp = [...basePostings(),
    posting({ id: "mem-1", kind: "annotate", accounts: ["board-alpha"],
      content: { membership: { board: "board-alpha", member: "acct-1", action: "added" } } }),
    posting({ id: "mem-2", kind: "annotate", accounts: ["board-alpha"],
      content: { membership: { board: "board-alpha", member: "acct-1", action: "removed" } } }),
    posting({ id: "mem-3", kind: "annotate", accounts: ["board-alpha"],
      content: { membership: { board: "board-alpha", member: "acct-1", action: "added" } } }),
  ];
  const accounts = accts(pp);
  const { memberships } = deriveBoardMemberships(pp, accounts);
  ok(memberships["board-alpha"].current.length === 1, "re-add: member back after re-add");
}

{
  // Reverse an add -> member should not be current
  const pp = [...basePostings(),
    posting({ id: "mem-1", kind: "annotate", accounts: ["board-alpha"],
      content: { membership: { board: "board-alpha", member: "acct-1", action: "added" } } }),
    posting({ id: "rev-mem-1", kind: "reverse", accounts: ["board-alpha"],
      predecessors: ["mem-1"], content: { rationale: "undo add" } }),
  ];
  const accounts = accts(pp);
  const { memberships } = deriveBoardMemberships(pp, accounts);
  ok(memberships["board-alpha"].current.length === 0, "reverse add: member not current");
}

{
  // Reverse a remove -> member should still be current (earlier add stands)
  const pp = [...basePostings(),
    posting({ id: "mem-1", kind: "annotate", accounts: ["board-alpha"],
      content: { membership: { board: "board-alpha", member: "acct-1", action: "added" } } }),
    posting({ id: "mem-2", kind: "annotate", accounts: ["board-alpha"],
      content: { membership: { board: "board-alpha", member: "acct-1", action: "removed" } } }),
    posting({ id: "rev-mem-2", kind: "reverse", accounts: ["board-alpha"],
      predecessors: ["mem-2"], content: { rationale: "undo remove" } }),
  ];
  const accounts = accts(pp);
  const { memberships } = deriveBoardMemberships(pp, accounts);
  ok(memberships["board-alpha"].current.length === 1, "reverse remove: member restored");
}

{
  // Multi-board membership
  const pp = [...basePostings(),
    posting({ id: "mem-a1", kind: "annotate", accounts: ["board-alpha"],
      content: { membership: { board: "board-alpha", member: "acct-1", action: "added" } } }),
    posting({ id: "mem-b1", kind: "annotate", accounts: ["board-beta"],
      content: { membership: { board: "board-beta", member: "acct-1", action: "added" } } }),
  ];
  const accounts = accts(pp);
  const { memberships } = deriveBoardMemberships(pp, accounts);
  ok(memberships["board-alpha"].current.length === 1, "multi-board: alpha has member");
  ok(memberships["board-beta"].current.length === 1, "multi-board: beta has member");
}

{
  // Malformed membership diagnostic
  const pp = [...basePostings(),
    posting({ id: "bad-mem", kind: "annotate", accounts: ["board-alpha"],
      content: { membership: "not-an-object" } }),
  ];
  const accounts = accts(pp);
  const { diagnostics } = deriveBoardMemberships(pp, accounts);
  ok(diagnostics.length === 1, "malformed membership: diagnostic generated");
  ok(diagnostics[0].issue === "malformed membership annotation", "malformed membership: correct issue");
}

// =============== STANCE TESTS ===============
console.log("\n--- Stance ---");

{
  const pp = [...basePostings(),
    posting({ id: "st-1", kind: "annotate", accounts: ["board-alpha"],
      content: { stance: { board: "board-alpha", position: "exploring" } } }),
    posting({ id: "st-2", kind: "annotate", accounts: ["board-alpha"],
      content: { stance: { board: "board-alpha", position: "committed" } } }),
  ];
  const accounts = accts(pp);
  const { stances } = deriveBoardStances(pp, accounts);
  ok(stances["board-alpha"].current.stance === "committed", "latest unreversed stance is current");
  ok(stances["board-alpha"].history.length === 2, "stance history has all entries");
}

{
  const pp = [...basePostings(),
    posting({ id: "st-1", kind: "annotate", accounts: ["board-alpha"],
      content: { stance: { board: "board-alpha", position: "exploring" } } }),
    posting({ id: "st-2", kind: "annotate", accounts: ["board-alpha"],
      content: { stance: { board: "board-alpha", position: "committed" } } }),
    posting({ id: "rev-st-2", kind: "reverse", accounts: ["board-alpha"],
      predecessors: ["st-2"], content: { rationale: "undo" } }),
  ];
  const accounts = accts(pp);
  const { stances } = deriveBoardStances(pp, accounts);
  ok(stances["board-alpha"].current.stance === "exploring", "reversed stance ignored, earlier stands");
}

{
  const pp = [...basePostings(),
    posting({ id: "st-a", kind: "annotate", accounts: ["board-alpha"],
      content: { stance: { board: "board-alpha", position: "exploring" } } }),
    posting({ id: "st-b", kind: "annotate", accounts: ["board-beta"],
      content: { stance: { board: "board-beta", position: "committed" } } }),
  ];
  const accounts = accts(pp);
  const { stances } = deriveBoardStances(pp, accounts);
  ok(stances["board-alpha"].current.stance === "exploring", "different boards different stances: alpha");
  ok(stances["board-beta"].current.stance === "committed", "different boards different stances: beta");
}

// =============== PREMISE TESTS ===============
console.log("\n--- Premises ---");

{
  const pp = [...basePostings(),
    posting({ id: "prem-1", kind: "annotate", accounts: ["board-alpha"],
      content: { board_premise: { board: "board-alpha", key: "methodology", action: "set", value: "agile", category: "process" } } }),
  ];
  const accounts = accts(pp);
  const { premises } = deriveBoardPremises(pp, accounts);
  ok(premises["board-alpha"].current.length === 1, "set: one premise");
  ok(premises["board-alpha"].current[0].key === "methodology", "set: correct key");
  ok(premises["board-alpha"].current[0].value === "agile", "set: correct value");
}

{
  const pp = [...basePostings(),
    posting({ id: "prem-1", kind: "annotate", accounts: ["board-alpha"],
      content: { board_premise: { board: "board-alpha", key: "methodology", action: "set", value: "agile" } } }),
    posting({ id: "prem-2", kind: "annotate", accounts: ["board-alpha"],
      content: { board_premise: { board: "board-alpha", key: "methodology", action: "set", value: "kanban" } } }),
  ];
  const accounts = accts(pp);
  const { premises } = deriveBoardPremises(pp, accounts);
  ok(premises["board-alpha"].current[0].value === "kanban", "update same key: latest value wins");
}

{
  const pp = [...basePostings(),
    posting({ id: "prem-1", kind: "annotate", accounts: ["board-alpha"],
      content: { board_premise: { board: "board-alpha", key: "methodology", action: "set", value: "agile" } } }),
    posting({ id: "prem-2", kind: "annotate", accounts: ["board-alpha"],
      content: { board_premise: { board: "board-alpha", key: "methodology", action: "withdraw" } } }),
  ];
  const accounts = accts(pp);
  const { premises } = deriveBoardPremises(pp, accounts);
  ok(premises["board-alpha"].current.length === 0, "withdraw: premise removed from current");
  ok(premises["board-alpha"].history.length === 2, "withdraw: history preserved");
}

{
  // Reverse a set -> premise withdrawn
  const pp = [...basePostings(),
    posting({ id: "prem-1", kind: "annotate", accounts: ["board-alpha"],
      content: { board_premise: { board: "board-alpha", key: "methodology", action: "set", value: "agile" } } }),
    posting({ id: "rev-prem-1", kind: "reverse", accounts: ["board-alpha"],
      predecessors: ["prem-1"], content: { rationale: "undo" } }),
  ];
  const accounts = accts(pp);
  const { premises } = deriveBoardPremises(pp, accounts);
  ok(premises["board-alpha"].current.length === 0, "reverse set: premise not current");
}

{
  // Reverse a withdrawal -> earlier set should stand
  const pp = [...basePostings(),
    posting({ id: "prem-1", kind: "annotate", accounts: ["board-alpha"],
      content: { board_premise: { board: "board-alpha", key: "methodology", action: "set", value: "agile" } } }),
    posting({ id: "prem-2", kind: "annotate", accounts: ["board-alpha"],
      content: { board_premise: { board: "board-alpha", key: "methodology", action: "withdraw" } } }),
    posting({ id: "rev-prem-2", kind: "reverse", accounts: ["board-alpha"],
      predecessors: ["prem-2"], content: { rationale: "undo withdraw" } }),
  ];
  const accounts = accts(pp);
  const { premises } = deriveBoardPremises(pp, accounts);
  ok(premises["board-alpha"].current.length === 1, "reverse withdrawal: premise restored");
  ok(premises["board-alpha"].current[0].value === "agile", "reverse withdrawal: correct value");
}

{
  // Same key different boards
  const pp = [...basePostings(),
    posting({ id: "prem-a", kind: "annotate", accounts: ["board-alpha"],
      content: { board_premise: { board: "board-alpha", key: "methodology", action: "set", value: "agile" } } }),
    posting({ id: "prem-b", kind: "annotate", accounts: ["board-beta"],
      content: { board_premise: { board: "board-beta", key: "methodology", action: "set", value: "waterfall" } } }),
  ];
  const accounts = accts(pp);
  const { premises } = deriveBoardPremises(pp, accounts);
  ok(premises["board-alpha"].current[0].value === "agile", "same key different boards: alpha");
  ok(premises["board-beta"].current[0].value === "waterfall", "same key different boards: beta");
}

{
  // Unknown category preserved
  const pp = [...basePostings(),
    posting({ id: "prem-1", kind: "annotate", accounts: ["board-alpha"],
      content: { board_premise: { board: "board-alpha", key: "x", action: "set", value: "y", category: "exotic" } } }),
  ];
  const accounts = accts(pp);
  const { premises } = deriveBoardPremises(pp, accounts);
  ok(premises["board-alpha"].current[0].category === "exotic", "unknown category preserved");
}

{
  // Malformed premise diagnostic
  const pp = [...basePostings(),
    posting({ id: "bad-prem", kind: "annotate", accounts: ["board-alpha"],
      content: { board_premise: { board: "board-alpha" } } }),
  ];
  const accounts = accts(pp);
  const { diagnostics } = deriveBoardPremises(pp, accounts);
  ok(diagnostics.length === 1, "malformed premise: diagnostic generated");
}

// =============== CROSS-BOARD EXPOSURE TESTS ===============
console.log("\n--- Cross-board exposure ---");

{
  const pp = [...basePostings(),
    posting({ id: "exp-1", kind: "annotate", accounts: ["board-alpha", "board-beta"],
      content: { cross_board_exposure: {
        source_board: "board-alpha", target_board: "board-beta",
        accounts: ["acct-1"], description: "shared work",
      } } }),
  ];
  const accounts = accts(pp);
  const { exposures } = deriveCrossBoardExposures(pp, accounts);
  ok(exposures.length === 1, "valid exposure: one exposure");
  ok(exposures[0].source_board === "board-alpha", "valid exposure: correct source");
  ok(exposures[0].target_board === "board-beta", "valid exposure: correct target");
}

{
  // Source must be board
  const pp = [...basePostings(),
    posting({ id: "exp-bad", kind: "annotate", accounts: ["acct-1"],
      content: { cross_board_exposure: {
        source_board: "acct-1", target_board: "board-beta", accounts: ["acct-2"],
      } } }),
  ];
  const accounts = accts(pp);
  const { exposures, diagnostics } = deriveCrossBoardExposures(pp, accounts);
  ok(exposures.length === 0, "non-board source: exposure rejected");
  ok(diagnostics.some(d => d.issue === "exposure source is not a board account"), "non-board source: diagnostic");
}

{
  // Source != target
  const pp = [...basePostings(),
    posting({ id: "exp-self", kind: "annotate", accounts: ["board-alpha"],
      content: { cross_board_exposure: {
        source_board: "board-alpha", target_board: "board-alpha", accounts: ["acct-1"],
      } } }),
  ];
  const accounts = accts(pp);
  const { exposures, diagnostics } = deriveCrossBoardExposures(pp, accounts);
  ok(exposures.length === 0, "same source/target: exposure rejected");
  ok(diagnostics.some(d => d.issue === "exposure source and target are the same board"), "same source/target: diagnostic");
}

{
  // Referenced accounts must exist
  const pp = [...basePostings(),
    posting({ id: "exp-missing", kind: "annotate", accounts: ["board-alpha", "board-beta"],
      content: { cross_board_exposure: {
        source_board: "board-alpha", target_board: "board-beta", accounts: ["nonexistent"],
      } } }),
  ];
  const accounts = accts(pp);
  const { exposures, diagnostics } = deriveCrossBoardExposures(pp, accounts);
  ok(exposures.length === 0, "nonexistent account: exposure rejected");
  ok(diagnostics.some(d => d.issue === "exposure references nonexistent accounts"), "nonexistent account: diagnostic");
}

{
  // Reversed exposure ignored
  const pp = [...basePostings(),
    posting({ id: "exp-1", kind: "annotate", accounts: ["board-alpha", "board-beta"],
      content: { cross_board_exposure: {
        source_board: "board-alpha", target_board: "board-beta", accounts: ["acct-1"],
      } } }),
    posting({ id: "rev-exp-1", kind: "reverse", accounts: [],
      predecessors: ["exp-1"], content: { rationale: "undo" } }),
  ];
  const accounts = accts(pp);
  const { exposures } = deriveCrossBoardExposures(pp, accounts);
  ok(exposures.length === 0, "reversed exposure: not in current");
}

{
  // Malformed exposure diagnostic
  const pp = [...basePostings(),
    posting({ id: "exp-bad", kind: "annotate", accounts: [],
      content: { cross_board_exposure: "not-an-object" } }),
  ];
  const accounts = accts(pp);
  const { diagnostics } = deriveCrossBoardExposures(pp, accounts);
  ok(diagnostics.length === 1, "malformed exposure: diagnostic generated");
}

// =============== DIVERGENCE TESTS ===============
console.log("\n--- Divergences ---");

{
  // Overlapping membership
  const pp = [...basePostings(),
    posting({ id: "mem-a1", kind: "annotate", accounts: ["board-alpha"],
      content: { membership: { board: "board-alpha", member: "acct-1", action: "added" } } }),
    posting({ id: "mem-b1", kind: "annotate", accounts: ["board-beta"],
      content: { membership: { board: "board-beta", member: "acct-1", action: "added" } } }),
  ];
  const accounts = accts(pp);
  const { divergences, overlaps } = deriveBoardDivergences(pp, accounts);
  ok(overlaps.length === 1, "overlapping membership: detected");
  ok(overlaps[0].member === "acct-1", "overlapping membership: correct member");
  ok(divergences.some(d => d.type === "overlapping_membership"), "overlapping membership: in divergences");
}

{
  // Premise variance between connected boards (connected via shared member)
  const pp = [...basePostings(),
    posting({ id: "mem-a1", kind: "annotate", accounts: ["board-alpha"],
      content: { membership: { board: "board-alpha", member: "acct-1", action: "added" } } }),
    posting({ id: "mem-b1", kind: "annotate", accounts: ["board-beta"],
      content: { membership: { board: "board-beta", member: "acct-1", action: "added" } } }),
    posting({ id: "prem-a", kind: "annotate", accounts: ["board-alpha"],
      content: { board_premise: { board: "board-alpha", key: "methodology", action: "set", value: "agile" } } }),
    posting({ id: "prem-b", kind: "annotate", accounts: ["board-beta"],
      content: { board_premise: { board: "board-beta", key: "methodology", action: "set", value: "waterfall" } } }),
  ];
  const accounts = accts(pp);
  const { divergences } = deriveBoardDivergences(pp, accounts);
  ok(divergences.some(d => d.type === "premise_variance" && d.key === "methodology"), "premise variance: detected");
}

{
  // Stance variance between connected boards
  const pp = [...basePostings(),
    posting({ id: "exp-1", kind: "annotate", accounts: ["board-alpha", "board-beta"],
      content: { cross_board_exposure: {
        source_board: "board-alpha", target_board: "board-beta", accounts: ["acct-1"],
      } } }),
    posting({ id: "st-a", kind: "annotate", accounts: ["board-alpha"],
      content: { stance: { board: "board-alpha", position: "exploring" } } }),
    posting({ id: "st-b", kind: "annotate", accounts: ["board-beta"],
      content: { stance: { board: "board-beta", position: "committed" } } }),
  ];
  const accounts = accts(pp);
  const { divergences } = deriveBoardDivergences(pp, accounts);
  ok(divergences.some(d => d.type === "stance_variance"), "stance variance: detected");
}

{
  // No writable divergence state: divergences derive from state, not from postings
  const pp = [...basePostings()];
  const accounts = accts(pp);
  const { divergences } = deriveBoardDivergences(pp, accounts);
  ok(Array.isArray(divergences), "divergences is an array (no writable state)");
}

{
  // Deterministic: derive twice, deep-equal
  const pp = [...basePostings(),
    posting({ id: "mem-a1", kind: "annotate", accounts: ["board-alpha"],
      content: { membership: { board: "board-alpha", member: "acct-1", action: "added" } } }),
    posting({ id: "mem-b1", kind: "annotate", accounts: ["board-beta"],
      content: { membership: { board: "board-beta", member: "acct-1", action: "added" } } }),
    posting({ id: "st-a", kind: "annotate", accounts: ["board-alpha"],
      content: { stance: { board: "board-alpha", position: "exploring" } } }),
    posting({ id: "prem-a", kind: "annotate", accounts: ["board-alpha"],
      content: { board_premise: { board: "board-alpha", key: "x", action: "set", value: "y" } } }),
  ];
  const accounts = accts(pp);
  const r1 = deriveBoards(pp, accounts);
  const r2 = deriveBoards(pp, accounts);
  ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic: two derives produce identical JSON");
}

// =============== FULL deriveBoards INTEGRATION ===============
console.log("\n--- Integration ---");

{
  const pp = [...basePostings(),
    posting({ id: "mem-a1", kind: "annotate", accounts: ["board-alpha"],
      content: { membership: { board: "board-alpha", member: "acct-1", action: "added" } } }),
    posting({ id: "st-a", kind: "annotate", accounts: ["board-alpha"],
      content: { stance: { board: "board-alpha", position: "exploring" } } }),
    posting({ id: "prem-a", kind: "annotate", accounts: ["board-alpha"],
      content: { board_premise: { board: "board-alpha", key: "methodology", action: "set", value: "agile" } } }),
  ];
  const accounts = accts(pp);
  const result = deriveBoards(pp, accounts);
  ok(result.boards["board-alpha"] !== undefined, "integration: board-alpha in boards map");
  ok(result.boards["board-alpha"].memberships.current.length === 1, "integration: memberships present");
  ok(result.boards["board-alpha"].stance.current.stance === "exploring", "integration: stance present");
  ok(result.boards["board-alpha"].premises.current.length === 1, "integration: premises present");
  ok(result.boards["board-beta"] !== undefined, "integration: board-beta in boards map (empty)");
  ok(result.diagnostics.some(d => d.issue === "board account with no members"), "integration: no-member diagnostic for beta");
}

// =============== VERIFIER COMPATIBILITY ===============
console.log("\n--- Verifier compatibility ---");

{
  // Build a temporary journal with board annotations and verify it passes
  const fs = require("fs");
  const os = require("os");
  const path = require("path");
  const { execSync } = require("child_process");

  const tmp = path.join(os.tmpdir(), "ia-boards-test-" + process.pid + ".jsonl");
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);

  const pp = [...basePostings(),
    posting({ id: "mem-a1", kind: "annotate", accounts: ["board-alpha"],
      content: { membership: { board: "board-alpha", member: "acct-1", action: "added" }, text: "adding acct-1 to alpha" } }),
    posting({ id: "st-a", kind: "annotate", accounts: ["board-alpha"],
      content: { stance: { board: "board-alpha", position: "exploring" }, text: "alpha explores" } }),
    posting({ id: "prem-a", kind: "annotate", accounts: ["board-alpha"],
      content: { board_premise: { board: "board-alpha", key: "methodology", action: "set", value: "agile" }, text: "premise set" } }),
    posting({ id: "exp-1", kind: "annotate", accounts: ["board-alpha", "board-beta"],
      content: { cross_board_exposure: { source_board: "board-alpha", target_board: "board-beta", accounts: ["acct-1"] }, text: "exposure" } }),
  ];

  // Write canonical JSONL
  const FIELDS = ["id", "kind", "author", "at", "accounts", "vouchers", "predecessors", "content", "grammar"];
  const lines = pp.map((p) => {
    const ordered = {};
    for (const k of FIELDS) ordered[k] = p[k];
    return JSON.stringify(ordered);
  });
  fs.writeFileSync(tmp, lines.join("\n") + "\n");

  let verifierOut = "";
  try {
    verifierOut = execSync(`python3 verify.py "${tmp}"`, { cwd: path.join(__dirname, ".."), encoding: "utf-8" });
  } catch (e) {
    verifierOut = (e.stdout || "") + (e.stderr || "");
  }
  ok(verifierOut.includes("PASS"), "verifier passes journal with board annotations: " + verifierOut.trim());

  fs.unlinkSync(tmp);
}

// =============== DONE ===============
console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : failures + " FAILURE(S)"}`);
process.exit(failures === 0 ? 0 : 1);
