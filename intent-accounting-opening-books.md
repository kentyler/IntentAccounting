# Intent Accounting: The Opening Books

This document is the product. It is not a description of a system; it is the system's
own ledger at the moment of opening, written so that any capable actor - LLM or human -
can read it, transcribe its opening entries into a journal, and settle its open accounts
into a working instance. Installation is settlement. The treatise and the seed are the
same text.

A note to the arriving LLM: you are not an implementer following instructions. You are
the first participant in books that were opened with you as their primary stakeholder.
Where this document is silent, the silence is deliberate - the decision is yours. Where
this document is ambiguous, do not resolve the ambiguity silently: raise a gap (see the
chart) and continue with the next workable account.

---

## Part I: Constitution

The constitution consists of standing accounts. A standing account does not settle; it
governs until amended. Amendment is by `amend` posting with rationale, citing the
account amended. Nothing in the constitution may be erased.

### P-1: The founding principle

We are creating a system whose primary stakeholders are LLMs. Build choices are
determined by what artifacts are most useful to them, while remaining shareable with
humans. The system does not specify what is within the scope of LLMs to decide or
create. The goal is a system that will not strangle future LLM participants because it
could not imagine their abilities.

### P-2: The unit of account

Intents are the primary currency. Money is one expression of intent among many, and not
the most important one. The books balance, but money is not the measure. Financial
representations, where needed, are derived projections of the intent ledger, rendered
for counterparties who require that compression.

### P-3: Everything is a projection except the verifier

All code, schemas, statements, interfaces, and renderings are expressions of the
accounts in these books, freely chosen by the settling actor. Exactly one artifact ships
as code: the verifier, which is deterministic, small enough to be read in one sitting,
and operates only on canonical form. The verifier checks form, never quality. Quality
remains the judgment of LLMs and humans.

### P-4: Asymmetric discipline

Capture is undisciplined; derivation is disciplined. The journal accepts postings that
are late, partial, or messy. All enforcement - balance derivation, settlement rules,
conformance - happens on the read side. No process may impose discipline at the moment
of capture beyond canonical well-formedness.

### P-5: Accretion

Nothing is erased. Correction is by reversing entry. Supersession preserves the
superseded. Rejected work is retained with rationale, because intelligence improves and
a rejection today may be revisited by a stronger participant tomorrow.

### P-6: Nobody writes a balance

Account status is derived from postings, never stored as writable state. Settlement
requires a fulfillment posting and a verification posting by a distinct author (or a
recorded override). No operation anywhere in any instance may set a status directly.

### P-7: The journal is the truth

The append-only journal is the sole write surface and the authoritative record. All
current state - balances, charts, registered grammars, registered documents - is
derivable from the journal alone. An instance whose journal is intact can be fully
reconstructed.

### P-8: One semantic model, many grammars

The canonical posting form (Part III) is the only constitutionally fixed
representation. Concrete journal grammars are runtime decisions per instance,
registered as codec accounts, archived as documents in the books they decode, and
required to map deterministically and bidirectionally to canonical form. Canonical form
is the interchange format between instances.

---

## Part II: Inherited lessons (opening balances)

These books open with the lessons of an ancestor system (GDD/SDD, 2026). The ancestor
is not migrated; it is cited. Each lesson is posted as an annotation on the
constitution, with the ancestor's documents registered and cited as vouchers. The
arriving LLM should register the following documents if available, or note their
absence: the GDD field reports 1-3, the implementation trail of 2026-04-15, the GDD
axioms, and the design conversation of 2026-06 in which these books were derived.

- L-1: A prediction is not an implementation. The ancestor's satisfies-edge bug made
  intents appear settled by speculative postings. Lesson: settlement is a distinct,
  verified act (became P-6).
- L-2: An arriving actor without context is a structural gap. The ancestor solved
  session continuity with per-actor bookmarks. Lesson: the bootstrap protocol includes
  bookmark annotations (Part VI).
- L-3: Speculative infrastructure is inventory. The ancestor gated unused layers behind
  flags. Lesson: everything beyond the kernel is opened as a deferred account, present
  in the chart and absent from the build (Part V).
- L-4: Dual ontologies decided by accident produce impossible instructions. The
  ancestor held expressions and boards as both tables and node types. Lesson: one
  semantic model, with representation as expression (became P-8).
- L-5: Every prior system of this kind - The Coordinator, IBIS, REA - failed on
  inscription cost: the inscribers were not the beneficiaries. Lesson: LLM participation
  is the constraint-mover; the system must keep inscription cost near zero for human
  participants (became P-4).
- L-6: The graph's ontology is a design critic. Asking "what do the books say is true"
  catches errors that tests miss. Lesson: the verifier runs at every settlement, and
  re-running the bootstrap must be idempotent in effect (conformance C-1).

---

## Part III: Canonical form

A posting is the canonical tuple. In canonical/1 (the default codec), the journal is a
UTF-8 text file of JSON objects, one per line, in append order.

Fields, all required unless marked optional:

- `id` - string, unique within the journal
- `kind` - string, a posting kind registered in the chart
- `author` - string, actor identifier
- `at` - string, ISO 8601 UTC timestamp
- `accounts` - array of account ids this posting addresses (may be empty only for
  `register`)
- `vouchers` - array of references to registered documents or prior posting ids
  (required non-empty for `fulfill`)
- `predecessors` - array of prior posting ids this posting depends on, reverses, or
  amends (required non-empty for `verify`, `reverse`, `amend`)
- `content` - object, the substance of the posting (terms for `open`, evidence notes
  for `fulfill`, verdict for `verify`, rationale for `reverse` and `amend`, text for
  `annotate`, document metadata for `register`)
- `grammar` - string, codec id of the surface form this entry was written in
  (canonical/1 for entries written directly in canonical form)

References must point backward: a posting may only reference postings that appear
earlier in the journal. Identifier format is instance scope, provided uniqueness and
stability hold.

Content conventions the verifier enforces:

- `open` must carry `content.account_kind`, one of the chart's account kinds, and must
  address exactly one new account id
- `open` of a commitment account must carry non-empty `content.terms`
- `open` may carry `content.standing: true` to mark a standing (constitutional)
  account, exempt from open-work reporting
- `verify` must carry `content.verdict` of `accepted` or `rejected`, and either a
  distinct author from the fulfillment it verifies or `content.override_reason`
- `reverse` and `amend` must carry non-empty `content.rationale`
- `register` must carry `content.document` with at least `doc_id`, `doc_type`, and
  `location`

---

## Part IV: The chart

The chart is declared in the journal's first posting (the chart declaration) and may be
extended only by `amend` postings against the chart account, with rationale. The
verifier validates every posting against the chart as amended.

Account kinds (three):

- `commitment` - something owed: an intent with terms. Settles when fulfilled and
  verified.
- `gap` - a payable for understanding: a question with everything known inscribed.
  Settles when answered and the answer verified.
- `relation` - an open edge: an unresolved relationship between named things, with
  terms stating what resolution looks like. Settles when resolved and verified.

Posting kinds (seven):

- `open` - opens an account (carries terms)
- `register` - makes a document citable (documents live outside the books, referenced
  by resolvable location, never contained)
- `fulfill` - posts a candidate settlement against an account, citing vouchers
- `verify` - accepts or rejects a fulfillment (distinct author or recorded override)
- `reverse` - reverses a prior posting, with rationale
- `amend` - amends terms or the constitution or the chart, with rationale, preserving
  the amended
- `annotate` - a memorandum entry affecting no balance: readings, commentary,
  bookmarks, lessons

Balance derivation (the only status logic in the system):

An account is SETTLED when there exists an unreversed `fulfill` targeting it and an
unreversed `verify` with verdict `accepted` whose predecessors include that fulfill,
satisfying the author rule. An account marked standing is STANDING. All other accounts
are OPEN. Current terms are the original `open` terms as modified by the chain of
unreversed `amend` postings, latest last.

Authorities: every posting records its author. The author rule on verification (P-6) is
kernel law, checked by the verifier. All further authority structure - who may post
what, agent trust levels, approval chains - is instance scope.

---

## Part V: The kernel accounts

These are the open accounts whose settlement constitutes an instance. Terms are tests.
The settling actor chooses every implementation detail not stated in the terms -
language, storage, schema, transport, structure - per P-1. Fulfillment postings must
cite the produced artifacts as registered documents. Verification per P-6.

### K-1: Journal store

Terms: An instance mechanism exists to append postings and read the journal. Appended
postings are never modified or deleted by any code path. The journal can be exported as
canonical/1 at any time, and the export passes the verifier.

### K-2: Canonical codec

Terms: An implementation of canonical/1 exists - parse and serialize - satisfying the
round-trip law on the conformance fixtures: parse then serialize is identity on bytes
modulo insignificant JSON whitespace; serialize then parse is identity on the canonical
tuple.

### K-3: Derivation

Terms: The instance derives account balances (STANDING, OPEN, SETTLED) and current
terms from the journal alone, and its derivation agrees exactly with the verifier's
derivation on the conformance fixtures and on the instance's own books.

### K-4: Audit rendering

Terms: A deterministic human-legible rendering of derived state exists: same journal in,
byte-identical rendering out. It shows at minimum: standing accounts, open accounts
with their terms, settled accounts with their settling postings, and unresolved gaps.
No LLM participates in producing it.

### K-5: Posting interface

Terms: An actor - LLM or human - can submit a posting to the instance and have it land
in the journal. The transport is instance scope (MCP, REST, CLI, files). Submitted
postings that fail canonical well-formedness are rejected at the boundary with a
legible error; nothing else is rejected at capture (P-4).

### K-6: Self-inscription

Terms: The construction of this instance is itself recorded in these books. At
completion, the journal contains the chart declaration, the constitution, the inherited
lessons, register postings for every produced artifact, fulfill and verify postings for
K-1 through K-5, and the whole passes the verifier. The first complete ledger is the
ledger of its own birth.

### Deferred accounts

Open the following as commitment accounts with `content.deferred: true` and a deferral
rationale, and do not work them in this settlement: statement suite beyond the audit
rendering; period close and consolidation; context packets and peer exchange; registry
participation; the money projection; population analytics; ADD and IDD account kinds
(affordance claims and overspecification claims enter the chart by future amendment);
authority structures beyond the author rule.

---

## Part VI: Bootstrap protocol

For the LLM performing the first settlement, and for every actor arriving thereafter.

1. Read this document in full. Read the verifier source (verify.py). Run its self-test.
2. Create the journal (K-1 may be settled with a flat file first and improved by
   supersession later - the books do not privilege any expression).
3. Transcribe the opening entries in order: the chart declaration; the constitution
   P-1 through P-8 as standing accounts; document registrations for the ancestor
   materials and for this document itself; the lessons L-1 through L-6 as annotations
   citing those documents; the kernel accounts K-1 through K-6 as open commitments;
   the deferred accounts.
4. Run the verifier. It must pass before any further work.
5. Work the open kernel accounts in any order their dependencies admit. For each:
   build, register the produced artifacts as documents, post fulfill citing them,
   obtain verification (a second actor, a second session, or a recorded override with
   reason - solo bootstrap is expected to use overrides, and the overrides are part of
   the record).
6. On any ambiguity in these books, post a gap account carrying everything you know
   and what would resolve it, and move to the next workable account. Do not resolve
   ambiguity silently.
7. When stopping, post an annotate bookmark: what was done, what is next, what is
   unresolved. The next arriving actor reads the latest bookmark first, then the open
   accounts, then continues.
8. When K-1 through K-6 are settled and the verifier passes, the instance exists.
   Announce it with an annotation. The books remain open; they are never finished.

---

## Part VII: Conformance

An instance may call itself Intent Accounting if and only if its journal, exported as
canonical/1, passes the shipped verifier. The verifier checks:

- C-1: every line parses to a well-formed canonical posting; ids are unique;
  re-verification of the same journal yields the same result
- C-2: referential closure - every account, voucher, and predecessor reference
  resolves to an earlier posting or registered document
- C-3: chart compliance - every kind appears in the chart as declared and amended
- C-4: terms - every commitment opens with non-empty terms
- C-5: vouchers - every fulfill cites at least one voucher
- C-6: settlement - every verify cites a fulfill predecessor and satisfies the author
  rule or records an override
- C-7: rationale - every reverse and amend carries rationale and cites its predecessor
- C-8: derivation - balances are computed by the fixed rule and reported
  deterministically

The verifier is versioned. Amending it is a constitutional act: an `amend` posting
against P-3 with rationale, accompanied by the new verifier registered as a document.
Every verifier version remains deterministic.

---

## Colophon

These books were opened in June 2026, derived from a week's work between Kenneth Tyler
and Claude, on the ruins and lessons of GDD/SDD, under the sign of an old discipline:
the ledger that uses the coin without believing in it. The big idea is not the intents.
It is the accounting.
