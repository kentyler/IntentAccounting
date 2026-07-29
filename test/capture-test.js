#!/usr/bin/env node
/**
 * W-3 settlement evidence: capture conformance test.
 *
 * Demonstrates on a temporary journal:
 *   1. a duplicate id is REJECTED at capture (verifier C-1 well-formedness);
 *   2. a posting kind not in the chart is REJECTED at capture;
 *   3. a lawful chart amendment (amend ["chart"] add_posting_kinds) is
 *      ACCEPTED at capture, and the new kind is then ACCEPTED --
 *      the write surface no longer strangles a constitutional act (P-1);
 *   4. the resulting temporary journal passes the shipped verifier.
 *
 * Run: node test/capture-test.js
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const tmp = path.join(os.tmpdir(), "ia-capture-test-" + process.pid + ".jsonl");
if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
process.env.JOURNAL_PATH = tmp;

const journal = require("../src/journal");

let failures = 0;
function ok(cond, label) {
  console.log((cond ? "PASS" : "FAIL") + ": " + label);
  if (!cond) failures++;
}
function post(fields) {
  return journal.append(Object.assign({
    author: "tester", at: "2026-07-01T00:00:00Z",
    accounts: [], vouchers: [], predecessors: [],
    content: {}, grammar: "canonical/1",
  }, fields));
}
function rejected(fn) {
  try { fn(); return null; } catch (e) { return e.message; }
}

// chart declaration (the only posting an empty journal can receive)
post({ id: "p1", kind: "open", accounts: ["chart"], content: {
  standing: true,
  account_kinds: ["commitment", "gap", "relation"],
  posting_kinds: ["open", "register", "fulfill", "verify", "reverse", "amend", "annotate"],
}});

// 1. duplicate id rejected
const dup = rejected(() => post({ id: "p1", kind: "annotate", accounts: ["chart"], content: { text: "dup" } }));
ok(dup && dup.includes("duplicate id"), "duplicate id rejected at capture: " + dup);

// 2. unknown kind rejected before amendment
const unk = rejected(() => post({ id: "r1", kind: "reading", accounts: ["chart"], content: { text: "premature" } }));
ok(unk && unk.includes("not in the chart"), "kind outside chart rejected at capture: " + unk);

// 3. lawful chart amendment accepted; new kind then accepted
const amendErr = rejected(() => post({ id: "amend-chart-reading", kind: "amend", accounts: ["chart"],
  predecessors: ["p1"], content: { add_posting_kinds: ["reading"], rationale: "test: chart is amendable and capture must honor it" } }));
ok(amendErr === null, "chart amendment accepted at capture");
const newKindErr = rejected(() => post({ id: "r2", kind: "reading", accounts: ["chart"], content: { text: "now lawful" } }));
ok(newKindErr === null, "chart-amended kind accepted at capture");

// 4. temporary journal passes the shipped verifier (verify-2.py via selector)
let verifierOut = "";
try {
  verifierOut = execSync(`python3 verify.py "${tmp}"`, { cwd: path.join(__dirname, ".."), encoding: "utf-8" });
} catch (e) {
  verifierOut = (e.stdout || "") + (e.stderr || "");
}
ok(verifierOut.includes("PASS"), "verifier on resulting journal: " + verifierOut.trim());

// --- Presentment vocabulary tests (after chart amendment) ---

// 5. Add presentment kinds to chart
const amendPresentErr = rejected(() => post({
  id: "amend-chart-presentment", kind: "amend", accounts: ["chart"],
  predecessors: ["p1"],
  content: {
    add_posting_kinds: ["present", "accept", "dishonor", "protest"],
    add_account_kinds: ["board"],
    rationale: "test: adopt presentment vocabulary"
  },
}));
ok(amendPresentErr === null, "chart amendment adding presentment kinds accepted");

// 6. present accepted after chart amendment
post({
  id: "reg-test-doc", kind: "register", accounts: [],
  content: { document: { doc_id: "test-doc", doc_type: "test", location: "./test" } },
});
post({
  id: "open-test-acct", kind: "open", accounts: ["test-acct"],
  content: { account_kind: "commitment", terms: "test commitment" },
});
const presentErr = rejected(() => post({
  id: "present-1", kind: "present", accounts: ["test-acct"],
  vouchers: ["test-doc"], content: { note: "presentment" },
}));
ok(presentErr === null, "present accepted after chart amendment");

// 7. accept accepted after chart amendment
const acceptErr = rejected(() => post({
  id: "accept-1", kind: "accept", author: "distinct-author",
  accounts: ["test-acct"], predecessors: ["present-1"],
  content: { verdict: "accepted" },
}));
ok(acceptErr === null, "accept accepted after chart amendment");

// 8. open a board, present on another account, dishonor, protest
post({
  id: "open-test-board", kind: "open", accounts: ["test-board"],
  content: { account_kind: "board", terms: "test board" },
});
post({
  id: "open-test-acct2", kind: "open", accounts: ["test-acct2"],
  content: { account_kind: "commitment", terms: "second test commitment" },
});
post({
  id: "present-2", kind: "present", accounts: ["test-acct2"],
  vouchers: ["test-doc"], content: { note: "presentment 2" },
});
const dishonorErr = rejected(() => post({
  id: "dishonor-1", kind: "dishonor", author: "reviewer",
  accounts: ["test-acct2"], predecessors: ["present-2"],
  content: { ground: "evidence insufficient" },
}));
ok(dishonorErr === null, "dishonor accepted after chart amendment");

const protestErr = rejected(() => post({
  id: "protest-1", kind: "protest", accounts: ["test-board"],
  predecessors: ["dishonor-1"], content: { note: "escalating" },
}));
ok(protestErr === null, "protest accepted after chart amendment");

// 9. legacy fulfill/verify still accepted
post({
  id: "open-test-acct3", kind: "open", accounts: ["test-acct3"],
  content: { account_kind: "commitment", terms: "legacy test" },
});
const legacyFulfillErr = rejected(() => post({
  id: "fulfill-legacy", kind: "fulfill", accounts: ["test-acct3"],
  vouchers: ["test-doc"], content: { note: "legacy fulfill" },
}));
ok(legacyFulfillErr === null, "legacy fulfill still accepted");

const legacyVerifyErr = rejected(() => post({
  id: "verify-legacy", kind: "verify", author: "distinct-author",
  accounts: ["test-acct3"], predecessors: ["fulfill-legacy"],
  content: { verdict: "accepted" },
}));
ok(legacyVerifyErr === null, "legacy verify still accepted");

// 10. resulting journal passes verify-2.py
let verifier2Out = "";
try {
  verifier2Out = execSync(`python3 verify-2.py "${tmp}"`, { cwd: path.join(__dirname, ".."), encoding: "utf-8" });
} catch (e) {
  verifier2Out = (e.stdout || "") + (e.stderr || "");
}
ok(verifier2Out.includes("PASS"), "verify-2.py on resulting journal: " + verifier2Out.trim());

fs.unlinkSync(tmp);
process.exit(failures === 0 ? 0 : 1);
