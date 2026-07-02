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

// 4. temporary journal passes the shipped verifier
let verifierOut = "";
try {
  verifierOut = execSync(`python3 verify.py "${tmp}"`, { cwd: path.join(__dirname, ".."), encoding: "utf-8" });
} catch (e) {
  verifierOut = (e.stdout || "") + (e.stderr || "");
}
ok(verifierOut.includes("PASS"), "verifier on resulting journal: " + verifierOut.trim());

fs.unlinkSync(tmp);
process.exit(failures === 0 ? 0 : 1);
