#!/usr/bin/env node
/**
 * bootstrap.js - Transcribes the opening entries from the founding document
 * into journal.jsonl. This is the first act: the chart, the constitution,
 * the inherited lessons, the kernel accounts, and the deferred accounts.
 *
 * Author: founder (opening entries transcribed from the opening books)
 */

const fs = require("fs");
const path = require("path");

const JOURNAL = path.join(__dirname, "journal.jsonl");
const BASE_TIME = "2026-06-12T00:00:00Z";

let seq = 0;
function ts() {
  const s = seq++;
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `2026-06-12T${h}:${m}:${sec}Z`;
}

function posting(fields) {
  return JSON.stringify({
    id: fields.id,
    kind: fields.kind,
    author: fields.author || "founder",
    at: fields.at || ts(),
    accounts: fields.accounts || [],
    vouchers: fields.vouchers || [],
    predecessors: fields.predecessors || [],
    content: fields.content || {},
    grammar: "canonical/1",
  });
}

const entries = [];

// p1: Chart declaration
entries.push(
  posting({
    id: "p1",
    kind: "open",
    accounts: ["chart"],
    content: {
      standing: true,
      account_kinds: ["commitment", "gap", "relation"],
      posting_kinds: [
        "open",
        "register",
        "fulfill",
        "verify",
        "reverse",
        "amend",
        "annotate",
      ],
    },
  })
);

// p2-p9: Constitution P-1 through P-8
const constitution = [
  {
    id: "P-1",
    terms:
      "We are creating a system whose primary stakeholders are LLMs. Build choices are determined by what artifacts are most useful to them, while remaining shareable with humans. The system does not specify what is within the scope of LLMs to decide or create. The goal is a system that will not strangle future LLM participants because it could not imagine their abilities.",
  },
  {
    id: "P-2",
    terms:
      "Intents are the primary currency. Money is one expression of intent among many, and not the most important one. The books balance, but money is not the measure. Financial representations, where needed, are derived projections of the intent ledger, rendered for counterparties who require that compression.",
  },
  {
    id: "P-3",
    terms:
      "All code, schemas, statements, interfaces, and renderings are expressions of the accounts in these books, freely chosen by the settling actor. Exactly one artifact ships as code: the verifier, which is deterministic, small enough to be read in one sitting, and operates only on canonical form. The verifier checks form, never quality. Quality remains the judgment of LLMs and humans.",
  },
  {
    id: "P-4",
    terms:
      "Capture is undisciplined; derivation is disciplined. The journal accepts postings that are late, partial, or messy. All enforcement - balance derivation, settlement rules, conformance - happens on the read side. No process may impose discipline at the moment of capture beyond canonical well-formedness.",
  },
  {
    id: "P-5",
    terms:
      "Nothing is erased. Correction is by reversing entry. Supersession preserves the superseded. Rejected work is retained with rationale, because intelligence improves and a rejection today may be revisited by a stronger participant tomorrow.",
  },
  {
    id: "P-6",
    terms:
      "Account status is derived from postings, never stored as writable state. Settlement requires a fulfillment posting and a verification posting by a distinct author (or a recorded override). No operation anywhere in any instance may set a status directly.",
  },
  {
    id: "P-7",
    terms:
      "The append-only journal is the sole write surface and the authoritative record. All current state - balances, charts, registered grammars, registered documents - is derivable from the journal alone. An instance whose journal is intact can be fully reconstructed.",
  },
  {
    id: "P-8",
    terms:
      "The canonical posting form (Part III) is the only constitutionally fixed representation. Concrete journal grammars are runtime decisions per instance, registered as codec accounts, archived as documents in the books they decode, and required to map deterministically and bidirectionally to canonical form. Canonical form is the interchange format between instances.",
  },
];

constitution.forEach((p, i) => {
  entries.push(
    posting({
      id: `p${i + 2}`,
      kind: "open",
      accounts: [p.id],
      content: {
        standing: true,
        account_kind: "commitment",
        terms: p.terms,
      },
    })
  );
});

// p10: Register opening books as document D-books
entries.push(
  posting({
    id: "p10",
    kind: "register",
    accounts: [],
    content: {
      document: {
        doc_id: "D-books",
        doc_type: "founding-document",
        location: "./intent-accounting-opening-books.md",
      },
    },
  })
);

// p11-p16: Lessons L-1 through L-6 as annotations
const lessons = [
  {
    id: "L-1",
    account: "P-6",
    text: "A prediction is not an implementation. The ancestor's satisfies-edge bug made intents appear settled by speculative postings. Lesson: settlement is a distinct, verified act (became P-6).",
  },
  {
    id: "L-2",
    account: "P-1",
    text: "An arriving actor without context is a structural gap. The ancestor solved session continuity with per-actor bookmarks. Lesson: the bootstrap protocol includes bookmark annotations (Part VI).",
  },
  {
    id: "L-3",
    account: "P-3",
    text: "Speculative infrastructure is inventory. The ancestor gated unused layers behind flags. Lesson: everything beyond the kernel is opened as a deferred account, present in the chart and absent from the build (Part V).",
  },
  {
    id: "L-4",
    account: "P-8",
    text: "Dual ontologies decided by accident produce impossible instructions. The ancestor held expressions and boards as both tables and node types. Lesson: one semantic model, with representation as expression (became P-8).",
  },
  {
    id: "L-5",
    account: "P-4",
    text: "Every prior system of this kind - The Coordinator, IBIS, REA - failed on inscription cost: the inscribers were not the beneficiaries. Lesson: LLM participation is the constraint-mover; the system must keep inscription cost near zero for human participants (became P-4).",
  },
  {
    id: "L-6",
    account: "P-3",
    text: "The graph's ontology is a design critic. Asking 'what do the books say is true' catches errors that tests miss. Lesson: the verifier runs at every settlement, and re-running the bootstrap must be idempotent in effect (conformance C-1).",
  },
];

lessons.forEach((l, i) => {
  entries.push(
    posting({
      id: `p${i + 11}`,
      kind: "annotate",
      accounts: [l.account],
      vouchers: ["D-books"],
      content: { text: l.text },
    })
  );
});

// p17-p22: Kernel accounts K-1 through K-6
const kernels = [
  {
    id: "K-1",
    terms:
      "An instance mechanism exists to append postings and read the journal. Appended postings are never modified or deleted by any code path. The journal can be exported as canonical/1 at any time, and the export passes the verifier.",
  },
  {
    id: "K-2",
    terms:
      "An implementation of canonical/1 exists - parse and serialize - satisfying the round-trip law on the conformance fixtures: parse then serialize is identity on bytes modulo insignificant JSON whitespace; serialize then parse is identity on the canonical tuple.",
  },
  {
    id: "K-3",
    terms:
      "The instance derives account balances (STANDING, OPEN, SETTLED) and current terms from the journal alone, and its derivation agrees exactly with the verifier's derivation on the conformance fixtures and on the instance's own books.",
  },
  {
    id: "K-4",
    terms:
      "A deterministic human-legible rendering of derived state exists: same journal in, byte-identical rendering out. It shows at minimum: standing accounts, open accounts with their terms, settled accounts with their settling postings, and unresolved gaps. No LLM participates in producing it.",
  },
  {
    id: "K-5",
    terms:
      "An actor - LLM or human - can submit a posting to the instance and have it land in the journal. The transport is instance scope (MCP, REST, CLI, files). Submitted postings that fail canonical well-formedness are rejected at the boundary with a legible error; nothing else is rejected at capture (P-4).",
  },
  {
    id: "K-6",
    terms:
      "The construction of this instance is itself recorded in these books. At completion, the journal contains the chart declaration, the constitution, the inherited lessons, register postings for every produced artifact, fulfill and verify postings for K-1 through K-5, and the whole passes the verifier. The first complete ledger is the ledger of its own birth.",
  },
];

kernels.forEach((k, i) => {
  entries.push(
    posting({
      id: `p${i + 17}`,
      kind: "open",
      accounts: [k.id],
      content: {
        account_kind: "commitment",
        terms: k.terms,
      },
    })
  );
});

// p23-p30: Deferred accounts D-1 through D-8
const deferred = [
  {
    id: "D-1",
    terms: "Statement suite beyond audit rendering",
    rationale:
      "The audit rendering (K-4) is the kernel requirement. Richer statement forms - balance sheets, trial balances, period summaries - are deferred until the kernel is settled and usage patterns emerge.",
  },
  {
    id: "D-2",
    terms: "Period close and consolidation",
    rationale:
      "Period boundaries and consolidation across instances require operational experience with the kernel. Deferred until at least one instance has run for a meaningful duration.",
  },
  {
    id: "D-3",
    terms: "Context packets and peer exchange",
    rationale:
      "Inter-instance communication requires settled canonical codec (K-2) and posting interface (K-5) as prerequisites. Deferred until kernel accounts are settled.",
  },
  {
    id: "D-4",
    terms: "Registry participation",
    rationale:
      "A shared registry of instances requires peer exchange (D-3) as a prerequisite. Deferred.",
  },
  {
    id: "D-5",
    terms: "The money projection",
    rationale:
      "Financial representations are derived projections of the intent ledger (P-2). Deferred until the base derivation (K-3) and rendering (K-4) are settled and the projection requirements are understood.",
  },
  {
    id: "D-6",
    terms: "Population analytics",
    rationale:
      "Analytics over populations of accounts requires a settled derivation engine (K-3) and sufficient journal volume to make the analytics meaningful. Deferred.",
  },
  {
    id: "D-7",
    terms: "ADD and IDD account kinds",
    rationale:
      "Affordance claims and overspecification claims enter the chart by future amendment. Deferred until the base chart has been exercised through kernel settlement.",
  },
  {
    id: "D-8",
    terms: "Authority structures beyond the author rule",
    rationale:
      "The author rule on verification (P-6) is kernel law. All further authority structure - who may post what, agent trust levels, approval chains - is instance scope and deferred until multi-actor operation begins.",
  },
];

deferred.forEach((d, i) => {
  entries.push(
    posting({
      id: `p${i + 23}`,
      kind: "open",
      accounts: [d.id],
      content: {
        account_kind: "commitment",
        terms: d.terms,
        deferred: true,
        deferral_rationale: d.rationale,
      },
    })
  );
});

// Write journal
fs.writeFileSync(JOURNAL, entries.join("\n") + "\n", "utf-8");
console.log(`Wrote ${entries.length} opening entries to ${JOURNAL}`);
