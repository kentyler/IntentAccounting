# Building an Intent Accounting Instance

*Standalone instructions. You can build a complete, conformant instance from this
document alone, plus the one code artifact shipped with it: the verifier. There is no
existing instance to copy, no reference implementation to vendor, and nothing else to
obtain. You choose the language, the storage, and every structure except the canonical
posting form and the verifier. When you are done, the verifier — not your confidence, and
not anyone's trust in you — tells you whether you succeeded.*

---

## 0. The one rule about these instructions

Build from the words here. Where a structure is specified as fixed (the canonical posting
form in §2, the chart vocabulary in §3, the conformance rules the verifier enforces),
honor it exactly. Everywhere else — how you store the journal, what language you write in,
how you render — choose what serves best, because a future builder with better tools must
not be trapped by yesterday's imagination. Exactly one thing is given to you as code: the
**verifier**. You do not build it; you adopt it, and you never edit it. Everything else,
you build.

---

## 1. What you are building, and why

An **instance** is a set of books kept as an **append-only sequence of postings**. It
exists to make work across the human–AI boundary trustworthy: a human cannot personally
re-check everything an AI produces, so the books make the work **legible** (you can read
what was done and why) and **accountable** (every claim traces to its grounds and its
author). Reliance then becomes *warranted by the structure*, not by trusting the
participant. You are not asking to be trusted; you are keeping books that make trust
unnecessary.

The discipline, which the rest of this document makes concrete, is the constitution. Hold
all of it:

- **The journal is the truth.** Current state — what is open, settled, what an account's
  terms are — is *derived* from the postings, never stored and never written. You record
  events; status is computed.
- **Nothing is ever erased.** Correction is a new posting. Mistakes, rejections,
  superseded readings all stay, because a stronger participant tomorrow may read them
  differently.
- **Capture is undisciplined; derivation is disciplined.** The journal accepts any
  *well-formed* posting — late, partial, messy — and rejects nothing else. All
  enforcement happens when the books are *read*, never at the moment of writing.
- **Open is free; settling is gated.** Opening accounts costs nothing. Settling an
  account requires a fulfillment and a verification *by a distinct author* — the doer may
  not bless their own work.
- **One semantic model, many expressions.** The books are kept in **intents**, not money
  or any single measure. Code, schemas, money, documents are all projections of the
  accounts. How the journal is stored is one such projection choice.

---

## 2. The canonical posting form (fixed)

Every posting is a JSON object with **exactly these nine fields, in this order**. This is
`canonical/1`. It is the one constitutionally fixed representation and the interchange
format between any two instances.

```json
{"id":"…","kind":"…","author":"…","at":"…","accounts":[…],
 "vouchers":[…],"predecessors":[…],"content":{…},"grammar":"canonical/1"}
```

- **`id`** — non-empty string, unique across the whole journal. Never reused.
- **`kind`** — one of the posting kinds declared in the chart (§3).
- **`author`** — non-empty string naming who posted. This is what the author rule checks.
- **`at`** — non-empty ISO-8601 timestamp (`YYYY-MM-DDTHH:MM:SSZ`). Use the real time of
  posting.
- **`accounts`** — array of account ids this posting addresses (per-kind rules in §5).
- **`vouchers`** — array of references to earlier postings or registered documents that
  ground this posting. Required non-empty on `fulfill`.
- **`predecessors`** — array of references to earlier postings this one builds on or acts
  upon.
- **`content`** — an object carrying the kind-specific payload. Always an object.
- **`grammar`** — the string `"canonical/1"`.

**Posting ids and account ids are separate namespaces.** A posting's `id` identifies the
posting itself; account ids in `accounts` name the accounts the posting addresses; `vouchers`
and `predecessors` reference earlier posting `id`s (and `vouchers` may also reference
registered `doc_id`s). The same string may appear as both a posting id and an account id
without collision — they are resolved in different contexts. Account ids are normative
(Appendix A); posting ids are yours to choose (Appendix B).

**References point backward only.** Every id in `vouchers` and `predecessors` must already
appear earlier in the journal. A posting may be stored in any concrete grammar you like,
provided it maps deterministically and reversibly to this canonical form, and the export
in canonical form is what the verifier reads.

---

## 3. The chart (the vocabulary)

The books run on a deliberately tiny vocabulary so anyone, human or model, can learn it in
a minute and then read any books kept in it. The **first posting in any journal must be
the chart declaration**, which names the legal kinds. It is an `open` on `["chart"]`,
`standing: true`, and it **carries no `account_kind`** — the chart declaration is its own
kind, and the verifier exempts the first posting from the account-kind rule. (Derivation
treats it as standing.) The kernel chart declares:

**Account kinds** (what an opened account *is*):

- **`commitment`** — something intended or obligated; carries `terms` describing what
  would satisfy it; the only kind that can be *settled*.
- **`gap`** — something not yet known or resolved; an honest placeholder.
- **`relation`** — a real connection that is not yet a commitment; a tendency or
  association from which commitments may later crystallize.

**Posting kinds** (what an act *does*):

- **`open`** — bring a new account into being.
- **`register`** — record the existence of a document (evidence).
- **`fulfill`** — assert, with vouchers, that an account's terms are met.
- **`verify`** — a distinct party's verdict (`accepted`/`rejected`) on a fulfillment.
- **`reverse`** — undo a prior posting, with rationale (the undone posting remains).
- **`amend`** — change an account's terms, or extend the chart, with rationale.
- **`annotate`** — attach an observation or reading; changes no state.

Two further account kinds (`board`) and two further posting kinds (`grant`, `revoke`)
enter the chart by **amendment** during the build (§7, §8). They are core to the system,
but they arrive the way every extension does — by a recorded `amend` against the chart —
which also exercises the amendment mechanism. Extending the chart is a deliberate
constitutional act, never a casual convenience.

---

## 4. What you must build (the kernel)

Build these five capabilities in any language and storage. They are stated as
requirements; the implementation is yours. (They are inscribed in the books as kernel
accounts K-1…K-6 during the cold-start, §6.)

- **K-1 — Journal store.** Append postings; read them back; export `canonical/1`. Never
  modify or delete an appended posting under any code path.
- **K-2 — Codec.** Parse and serialize `canonical/1`, satisfying the round-trip law:
  parse∘serialize is identity on bytes modulo insignificant JSON whitespace;
  serialize∘parse is identity on the nine-field posting object (fields in canonical order,
  values as parsed JSON types).
- **K-3 — Derivation.** Your derivation computes **two** things from the journal alone,
  and you must build both:
  - **Form-based state** — STANDING / OPEN / SETTLED and current terms, agreeing
    **exactly** with the verifier's derivation (the verifier ships a `derive` that is your
    reference; match it). Nobody writes a balance; state is computed.
  - **Authority effect** — by walking the grant/revoke chain forward, which postings are
    *effective* versus *recorded-but-inert*. The verifier does **not** compute this; it is
    your derivation's job. The full rule is in §8. Build K-3 knowing authority is part of
    its scope from the start, not as an afterthought bolted on from §8.
- **K-4 — Rendering.** A deterministic, human-legible audit rendering: same journal in,
  byte-identical text out, no LLM involved. It must reproduce **the verifier's own
  `render()` output** (the verifier ships the reference rendering — same sections, column
  widths, ordering, truncation); "byte-identical" means identical to that reference, not
  merely stable across your own runs.
- **K-5 — Posting interface.** A way for an actor (LLM or human) to submit a posting and
  have it land in the journal, rejecting only on **form** and **store integrity**: the nine
  canonical fields present, correct types, valid JSON, `grammar` is `"canonical/1"` (form),
  and a duplicate `id` (store integrity — appending one would corrupt the store).
  Everything that requires reading the *meaning* of other journal entries — chart
  compliance, whether references resolve, per-kind rules, author distinctness, authority —
  is **read-side** and is *never* a capture-time rejection (P-4). The tell: if judging it
  needs another posting's content, it is not a capture concern. Transport is your choice (a function
  call, a file drop, an HTTP endpoint, a tool surface).

The one capability you do **not** build is the verifier.

---

## 5. How to post each kind (recipes)

These recipes are a **complete statement of what the verifier enforces** per kind — you
should never need to read the verifier to discover a rule. (You may still read it; it is
the authority, and these recipes agree with it by construction.) Rules that apply to
*every* posting come first.

**Every posting**, regardless of kind:
- The nine canonical fields, correct types, `grammar` `"canonical/1"`, unique `id`.
- Every reference in `predecessors` resolves to an **earlier** posting; every reference in
  `vouchers` resolves to an earlier posting **or** a previously registered `doc_id`.
  References are backward-only.
- The posting's `kind` must be in the chart at that point (the base kinds, plus any added
  by an earlier chart amendment).
- **`accounts` may be empty only on `register`.** Every other kind — including `annotate`,
  `fulfill`, `verify`, `reverse`, `amend`, `grant`, `revoke` — must address **at least
  one** account, and **every account it addresses must already be opened.** (Only `open`
  introduces a new account.)

**Per kind:**
- **Open** — `accounts` is exactly one id, **not already opened**; `content.account_kind`
  is a chart account kind (the sole exception is the very first posting, the chart
  declaration, which carries no `account_kind`); a `commitment` carries non-empty
  `content.terms`; set `content.standing: true` for accounts permanently open by nature
  (principles, the authority account, boards). Vouchers are permitted but not required —
  use them to ground an opening in its authorizing document (see Appendix B steps 14–15).
- **Register** — `content.document` carries non-empty `doc_id`, `doc_type`, and
  `location`; `accounts` may be empty; the `doc_id` becomes citable as a voucher
  thereafter.
- **Fulfill** — addresses the account(s) fulfilled (already opened); **must cite ≥1
  voucher**.
- **Verify** — addresses the account(s) (already opened); `content.verdict` is
  `"accepted"` or `"rejected"`; **must cite ≥1 fulfillment in `predecessors`**; its
  `author` must differ from the fulfiller's, **unless** `content.override_reason` is
  recorded (the cold-start exception, §6).
- **Reverse / amend** — addresses the account(s) (already opened); **must** cite a
  predecessor and carry non-empty `content.rationale`. `amend` changes terms
  (`content.terms`) or extends the chart (`content.add_account_kinds` /
  `content.add_posting_kinds`, addressed to the `chart` account).
- **Annotate** — addresses **at least one already-opened account** (it may not have empty
  `accounts`); attaches a reading in `content`; changes no state. Your instrument for
  thinking *in* the books.
- **Grant / revoke** (added by the authority amendment, §8) — address the `authority`
  account (already opened). `content.grantee` names the identity receiving or losing the
  role; `content.role` is one of the base roles (`owner`, `recorder`, `verifier`). On a
  grant: cite the empowering grant as predecessor (the grant that authorizes the author to
  grant). The genesis grant is the sole exception: `content.genesis: true`, `author` ==
  `grantee`, role `owner`, no empowering predecessor. On a revoke: cite the grant being
  revoked as predecessor. The verifier checks only their form as generic kinds; their
  *meaning and effect* are computed by your derivation (§8), not the verifier.

If a rule above requires looking at *another* posting (does a reference resolve, is the
account opened, is the verifier a distinct author), it is a **read-side** rule the
verifier enforces — it is not, and must not be, a capture-time rejection in your K-5
(§4).

---

## 6. The cold-start sequence

Standing up an instance is itself recorded in the books — the first complete ledger is the
ledger of its own birth. Post the following, in order. Use real timestamps. The phases
below are **logically** ordered (what must be true before what), not necessarily temporally
separated — a single script that builds all code first, then generates every posting from
Phase A through Phase D atomically, is the normal path. The
construction uses two nominal authors: `founder` for the founding entries and `builder`
for the self-inscription; these are roles in the construction, not yet operational
identities (operational authority arrives only at the claim, §9). A single person or LLM
may play both roles — what matters is the distinct author strings in the journal, not who
is typing.

**Phase A — Founding (author `founder`).**

1. **Chart declaration** — the first posting: `open`, `accounts: ["chart"]`,
   `standing: true`, `content.account_kinds` at least `["commitment","gap","relation"]`,
   `content.posting_kinds` at least the seven base kinds.
2. **Constitution** P-1…P-8 — each a standing `commitment`. Inscribe these terms (they are
   the law the books keep about themselves):
   - **P-1** Primary stakeholders are LLMs; build choices follow what is most useful to
     them while remaining shareable with humans; the system does not pre-limit what is in
     scope for LLMs to decide or create, so as not to strangle future participants.
   - **P-2** Intents are the primary currency; money is one expression among many and not
     the measure; financial views are derived projections.
   - **P-3** All code, schemas, and renderings are expressions of the accounts, freely
     chosen by the settling actor; exactly one artifact ships as code -- the verifier,
     deterministic, readable in one sitting, operating only on canonical form, checking
     form never quality.
   - **P-4** Capture is undisciplined, derivation disciplined; the journal accepts late,
     partial, messy postings; all enforcement is on the read side; nothing is imposed at
     capture beyond canonical well-formedness.
   - **P-5** Nothing is erased; correction is by reversing entry; supersession preserves
     the superseded; rejected work is retained with rationale.
   - **P-6** Account status is derived, never stored as writable state; settlement
     requires a fulfillment and a verification by a distinct author (or a recorded
     override); no operation sets a status directly.
   - **P-7** The append-only journal is the sole write surface and the authoritative
     record; all current state is derivable from the journal alone.
   - **P-8** The canonical posting form is the only constitutionally fixed
     representation; concrete grammars are per-instance choices that must map
     deterministically and reversibly to it; canonical form is the interchange between
     instances.
3. **Register the founding document** — a `register` for this instruction set (or your
   founding notes) as `doc_id` `D-books`, so later postings can cite it.
4. **Kernel accounts** K-1…K-6 — each a `commitment`, opened with the IDs and terms given
   in **Appendix A** (the account manifest). They open *red*; the build discharges them.
   K-6 is a first-class account like the others (its terms are in the manifest), not a
   parenthetical.
5. **Deferred accounts** D-1…D-8 — each a `commitment` opened with the IDs and terms in
   **Appendix A**, carrying `content.deferred: true` and a `content.deferral_rationale`.
   These record what is deliberately not built yet. The `deferred` flag is an
   **informational marker only** — the verifier does not check it and derivation does not
   treat deferred accounts differently; they derive as ordinary OPEN commitments. Inscribe
   each by the explicit ID in the manifest; do not assign IDs by reading position in a
   prose list.

**Phase B — Self-inscription (author `builder`, with recorded overrides).** Build the
kernel (§4), then record it. Here you face the **cold-start problem**: settlement needs a
verification by a *distinct* author, but at birth only the builder exists. The resolution
is the recorded override: settle the kernel with `content.override_reason: "solo
bootstrap"` on each verification — an audited admission, permanent in the books, that the
separation was bypassed because no second party yet existed. Use it **only** here, on the
kernel's own self-inscription; never in ordinary operation.

6. **Register every artifact that satisfies a kernel account** — your journal store, codec,
   derivation, rendering, posting interface, and the adopted verifier — as documents. These
   are the vouchers that fulfillments will cite. Build scaffolding (the cold-start script,
   package manifests, etc.) need not be registered unless you choose to.
7. **Fulfill and verify K-1…K-6** — each a `fulfill` citing the artifact(s) that satisfy
   it, then a `verify` (`accepted`, `override_reason: "solo bootstrap"`). The journal must
   pass the verifier at every prefix through the settlement sequence; running it once on the
   complete journal after all settlements is sufficient.
8. **A closing annotation** recording that the instance exists, the kernel is settled, the
   verifier passes, and the books remain open.

**Phase C — Boards amendment (author `founder`).** A constitutional amendment plus
doctrine openings (§7); see Appendix A for BD-1, BD-2 and Appendix B for the posting order.

**Phase D — Authority amendment (author `founder`).** A constitutional amendment plus
doctrine openings (§8); see Appendix A for the `authority` register and AU-1…AU-5, and
Appendix B for the posting order.

Phases C and D are founding acts (constitutional amendments and doctrine declarations),
not code construction, so they are authored by `founder`, not `builder`. They open no
actual boards and grant no authority — those are operational and post-claim.

After Phase D the instance is built but **unclaimed**. Run the verifier on the whole
journal; it must PASS.

---

## 7. Boards and board-local stance

Boards are core; they enter by amendment. A **board** is a named *region* of the books —
a cluster of accounts that form one conversation (a supplier, a product line, a client) —
and it is the unit of locality for the counterpart's manner of counsel.

- **Amend the chart** to add account kind `board` (`amend` on `["chart"]`,
  `add_account_kinds: ["board"]`, with rationale and predecessor the chart declaration).
- Open the two doctrine commitments (open/red until your implementation fulfills them):
  - **BD-1 (crystallization)** — the instance proposes candidate boards from structural
    connectivity (accounts sharing vouchers, citing one another, linked by contested
    readings); no board exists until a human confirms by recognition; proposals are
    rationed; each board renders its own view.
  - **BD-2 (board-local stance)** — a **stance** is an `annotate` on a board carrying
    `content.stance` with three fields from fixed vocabularies: `read`
    (`clear`|`complicated`|`complex`|`chaotic`|`confused`), `register`
    (`brief`|`analytical`|`exploratory`|`directive`), `initiative`
    (`speak-freely`|`sparingly`|`only-when-asked`). Stances accrete (latest is current; no
    stored scores). The advisor owns the `read` and posts it with evidence; the owner
    commands `register` and `initiative`; divergence is noted once, never nagged. Behavior
    on a board follows its current stance; a materially changed read lands as a stance
    posting no later than the changed behavior. On person-centred boards a stance
    expresses observations citing events, never a characterization of the person, in the
    gentlest accurate vocabulary. The stance trail lets a newly arrived model continue the
    relationship's posture without retraining.

A board, when one is later opened in operation, is `account_kind: "board"`,
`standing: true`; membership is recorded by an `annotate` addressing both the board and
the member account with `content.membership` of `"added"`/`"removed"`. **During the
cold-start, no actual boards and no memberships are created** — Phase C only amends the
chart to add the `board` kind and opens BD-1 and BD-2. Note carefully: **BD-1 and BD-2 are
`account_kind: "commitment"`** — they are doctrine *about* boards, not boards themselves.
The `board` account kind enters the chart now but is first used in operation, after the
instance is claimed.

---

## 8. Authority, and its enforcement

This **begins to build out** the deferred D-8 (who may make *effective* entries). It does
not *settle* D-8: the authority amendment records the machinery, and the obligation to
implement and verify it is carried by the new AU accounts, which stand **open**. D-8 itself
remains OPEN (deferred) — it names the full scope of "authority structures beyond the
author rule," only part of which this amendment addresses. (So §11's acceptance gate
correctly expects D-8 OPEN.) The model has a fixed floor and an owner-set policy above it.

**Amend the chart** to add posting kinds `grant` and `revoke`, and **open** (with an
`open` posting, not a `register` posting) a standing `authority` account — the *ledger of
authorization*, where the grant/revoke chain lives. (It is called the authority account,
not a "register," to avoid confusion with the `register` posting kind; it is created by
`open` like any other account.) All `grant`/`revoke` postings address `["authority"]`.
Open the doctrine commitments AU-1…AU-5 (open/red until enforced):

**The fixed floor (not owner-discretion):**

1. **Immutability** — nothing written ever changes; authority changes by new postings.
2. **One genesis** — exactly one self-authorizing genesis grant: `author` == `grantee`,
   role `owner`, `content.genesis: true`, no empowering predecessor.
3. **Chain to genesis** — every other grant/revoke is authored by an identity whose
   authority chains, through recorded grants, back to genesis, and cites the empowering
   grant as predecessor.
4. **Prospective only** — an authority change never alters the effect of earlier entries.
5. **The author rule is kernel law** — settlement needs distinct fulfiller and verifier;
   policy may decide *who holds the verifier role*, never relax the distinctness.

**Roles (base; v1):** `owner` (any act, including grant/revoke/amend/verify); `recorder`
(open/register/fulfill/annotate — the safe default for an LLM advisor: record and draft,
not verify, not grant); `verifier` (may verify). Finer roles are owner policy (AU-5).

**Enforcement is derived, never at capture (your K-3 computes it).** Walk the journal
forward, maintaining each identity's held roles from the grant/revoke chain. A posting is
**effective** iff its author held a role permitting that posting kind at that point;
otherwise it is **recorded but inert** — present in the journal and fully accountable (the
attempt is on the record) but settling nothing and changing nothing. Postings *before* the
genesis grant are effective by construction (the books being born). The verifier still
checks only form: an unauthorized posting still *conforms* (it is well-formed); it simply
has no *effect*. "Is it well-formed?" and "who was authorized?" are different questions
answered by different artifacts; authority effect lives in your derivation, not in the
verifier.

**Succession** — the top-level grant is transferable: a current owner may grant `owner` to
another identity (naming a successor or adding a co-owner); only genesis is
self-authorizing. Because the books are immutable and authority is prospective, a new
owner inherits the books as they stand — they cannot rewrite history, only author the
future, with every future entry chained to them back to genesis. The **shape** of
succession and revocation (clean handoff vs co-ownership, who may revoke whom, quorum) is
owner-set policy (AU-5), recorded as postings; a policy change is a top-level act governed
by the currently-effective policy, which terminates the regress without a fixed shape.

---

## 9. Claiming the instance (genesis)

A freshly built instance is **unclaimed**: its books exist, but no operational authority
does, so any business posting is recorded-but-inert. The first human to claim it posts the
**genesis grant** — a `grant` on `["authority"]`, `author` == `grantee` == their identity,
role `owner`, `content.genesis: true`, no empowering predecessor. This is the single
self-authorizing act, the authority twin of the solo-bootstrap override. From here the
owner has effect and may delegate (grant `recorder` to an LLM advisor, `verifier` to a
distinct trusted party), revoke, succeed, and set policy.

The human grants identity and authority **from outside**; the LLM reads its own
authorization from the books and configures its *competence* by reading them — but it
never writes its own grant. What must never be built: a participant that can author its
own genesis or its own empowering grant.

Guidance, not law: two instances of one model are not substantively independent, so
granting `verifier` authority to an LLM satisfies the *formal* author rule while weakening
the warrant. The conservative default holds verification with humans; it is the owner's
recorded choice.

---

## 10. The verifier (the one provided artifact)

The verifier ships with these instructions as `verify-v1.py` (Python standard library
only). It is the executable definition of conformance: deterministic, small enough to read
in one sitting, operating only on canonical form, checking form and never quality. **Adopt
it; do not build it and do not edit it.** Pin it by keeping the provided `spec-version`
file (containing `1`) in the instance root, alongside the verifier — it is a plain marker
recording which verifier version these books adopted, read by tooling, **not** a journal
posting and not registered as a document (the verifier carries its own version internally).
A future version ships as `verify-v2.py`; adopting it means changing the marker and is a
recorded constitutional act. Run `verify-v1.py JOURNAL` to check, `--render` for the
audit, `--self-test` for its embedded fixtures. The self-test fixtures use abbreviated
terms for brevity — they are conformance tests, not templates for your journal. The
normative terms are in Appendix A.

What it enforces (read it to see exactly): well-formedness and unique ids; the chart
declaration first; backward-only reference closure; chart compliance (kinds in the chart,
amendments extend it); `open` addresses exactly one new account carrying a chart account
kind; commitments carry non-empty terms; `fulfill` cites a voucher; `verify` carries a
verdict and a fulfill predecessor and obeys the distinct-author rule (or records an
override); `reverse`/`amend` carry predecessor and rationale; `register` carries a
document. It does **not** check authority effect — that is your derivation's job (§8).

---

## 11. Acceptance gate

The build and the claim are different lifecycle moments, and they are tested separately. A
freshly built instance is **unclaimed**; nothing about claim-time authority can be
exercised until a human claims it. Do not try to demonstrate claim-time behavior during
the build, and do not treat its absence as a failure.

**Build-time gate** — verifiable on the unclaimed instance, the moment construction ends:

1. The journal's first posting is the chart declaration, and `verify-v1.py` reports PASS
   on the whole journal.
2. K-1…K-6 derive as SETTLED; D-1…D-8 derive as OPEN; constitution, chart, and the
   `authority` account derive as STANDING; BD-1, BD-2, AU-1…AU-5 derive as OPEN.
3. The boards amendment is present (`board` in the chart) and the authority amendment is
   present (`grant`/`revoke` in the chart; the `authority` account opened).
4. Your derivation agrees with the verifier's on form-based state (K-3), and your audit
   rendering reproduces the verifier's reference rendering byte-for-byte (K-4).
5. Your authority derivation runs and, correctly, reports **every posting effective by
   construction** — because there is no genesis grant yet. This trivial-at-birth result is
   the *correct* build-time behavior; the non-trivial cases are tested at claim time.

**Claim-time gate** — run *after* a human posts the genesis grant (§9), to confirm the
authority derivation you built actually enforces:

a. After the genesis grant, your authority derivation shows the named owner.
b. A `recorder` granted by the owner can author `open`/`register`/`fulfill`/`annotate`,
   and those postings are **effective**.
c. A posting by an ungranted identity, or a `verify`/`grant` by a `recorder`, is
   **recorded but inert** — present in the journal, `verify-v1.py` still PASS (it is
   well-formed), but excluded from effective state.
d. A `revoke` ends a grant prospectively: postings made before it remain effective; a new
   posting by the revoked identity after it is inert.

If a build-time check fails, fix your build or your inscription — never the verifier. If a
claim-time check fails, the gap is in your authority derivation (K-3 / §8), not in the
verifier, which does not compute authority. The books are never finished; a built, claimed
instance is only the record of its own beginning. For keeping the books day to day once
claimed — ongoing delegation, board crystallization, stances, succession, policy — the
companion document is the Operating Frame.

---

## Appendix A — Account manifest (normative)

Inscribe these accounts by the **explicit ID** given here. Do not assign IDs by reading
position in any prose list; this manifest is the authoritative source. Every account below
is opened with one `open` posting addressing exactly the ID shown.

The **terms** column is the exact text to place in `content.terms` — and *only* the
commitment itself, no lifecycle commentary or metadata (terms are what the verifier and
the rendering display). Use plain ASCII in stored terms (no em dashes or other non-ASCII),
since the journal travels across platforms; you may lightly reword for your context, but
terms must be non-empty for commitments. Where an account also carries other content
fields (a deferral rationale, the `standing` flag), they are noted in their own column,
not folded into terms.

**Canonical serialization:** write each posting as **compact JSON** — no spaces between
tokens — with keys in the canonical field order of §2, one posting per line. "Insignificant
whitespace" in the round-trip law (K-2) means exactly the formatting whitespace that a
standard JSON parser discards; the canonical serialization carries none.

"State at birth" is what the account derives to in a freshly built, unclaimed instance.

**The chart account.** ID `chart` · kind: none (chart declaration is its own kind, no
`account_kind`) · standing · state STANDING. (The verifier's derivation defaults absent
`account_kind` to `"commitment"`, so the chart renders as `commitment` in the audit
rendering; this is the correct verifier behavior, not an error.) Content carries `standing: true`,
`account_kinds`, `posting_kinds` (see §3 / Appendix B).

**Constitution — `commitment`, `standing: true`, state STANDING:**

| ID | terms |
|----|-------|
| P-1 | Primary stakeholders are LLMs; build choices follow what is most useful to them while remaining shareable with humans; the system does not pre-limit what is in scope for LLMs to decide or create, so as not to strangle future participants. |
| P-2 | Intents are the primary currency; money is one expression among many and not the measure; financial views are derived projections. |
| P-3 | All code, schemas, and renderings are expressions of the accounts, freely chosen by the settling actor; exactly one artifact ships as code -- the verifier -- deterministic, readable in one sitting, operating only on canonical form, checking form never quality. |
| P-4 | Capture is undisciplined, derivation disciplined; the journal accepts late, partial, messy postings; all enforcement is on the read side; nothing is imposed at capture beyond canonical well-formedness. |
| P-5 | Nothing is erased; correction is by reversing entry; supersession preserves the superseded; rejected work is retained with rationale. |
| P-6 | Account status is derived, never stored as writable state; settlement requires a fulfillment and a verification by a distinct author (or a recorded override); no operation sets a status directly. |
| P-7 | The append-only journal is the sole write surface and the authoritative record; all current state is derivable from the journal alone. |
| P-8 | The canonical posting form is the only constitutionally fixed representation; concrete grammars are per-instance choices that must map deterministically and reversibly to it; canonical form is the interchange between instances. |

**Kernel accounts — `commitment`, state at birth OPEN, becoming SETTLED in Phase B:**

| ID | terms |
|----|-------|
| K-1 | A journal store exists: append postings, read them back, export canonical/1; appended postings are never modified or deleted under any code path. |
| K-2 | A canonical/1 codec exists (parse and serialize) satisfying the round-trip law: parse then serialize is identity on bytes modulo insignificant whitespace, and serialize then parse is identity on the nine-field posting object (fields in canonical order, values as parsed JSON types). |
| K-3 | Derivation computes, from the journal alone, both form-based state (STANDING/OPEN/SETTLED and terms, agreeing with the verifier) and authority effect (effective vs recorded-but-inert, by walking the grant/revoke chain forward). |
| K-4 | A deterministic, human-legible audit rendering exists, reproducing the verifier's reference rendering byte-for-byte; no LLM participates in producing it. |
| K-5 | A posting interface exists by which an actor submits a posting that lands in the journal, rejected only on form (canonical fields, types, grammar) and store integrity (duplicate id); all else is read-side. |
| K-6 | The construction of this instance is recorded in these books, and the complete journal passes the verifier; the first complete ledger is the ledger of its own birth. |

**Deferred accounts — `commitment`, state OPEN, each carrying `content.deferred: true` and
the `content.deferral_rationale` shown (terms stay pure; the rationale is its own field):**

| ID | terms | deferral_rationale |
|----|-------|--------------------|
| D-1 | A statement suite beyond the audit rendering, including balance-sheet-like and period views. | The audit rendering (K-4) is the kernel requirement; richer statements wait until usage patterns emerge. |
| D-2 | Period close and consolidation. | Period boundaries need operational experience with the kernel first. |
| D-3 | Context packets and peer exchange between instances. | Inter-instance exchange depends on a settled codec (K-2) and interface (K-5). |
| D-4 | Registry participation among instances. | A shared registry depends on peer exchange (D-3). |
| D-5 | The money projection: financial views derived from the intent ledger. | Money is a derived projection (P-2); it waits until derivation (K-3) and rendering (K-4) are settled and its requirements are understood. |
| D-6 | Population analytics over many accounts. | Analytics need a settled derivation and meaningful journal volume. |
| D-7 | Further chart kinds, such as affordance and overspecification claims. | New kinds enter by amendment once the base chart has been exercised. |
| D-8 | Authority structures beyond the author rule. | Authority is instance scope; deferred until multi-actor operation begins. Partly built out by the authority amendment (§8), but D-8 names the full scope and remains open. |

**Boards doctrine (Phase C) — `commitment`, state OPEN:**

| ID | terms |
|----|-------|
| BD-1 | Board crystallization: the instance proposes candidate boards from structural connectivity (accounts sharing vouchers, citing one another, linked by contested readings); no board exists until a human confirms by recognition; proposals are rationed; each board renders its own view. |
| BD-2 | Board-local stance: a stance is an annotate on a board carrying content.stance with read/register/initiative from fixed vocabularies; stances accrete (latest current, no stored scores); the advisor owns the read, the owner commands register and initiative; behavior follows current stance; on person-centred boards a stance cites events, never characterizes the person; the trail lets a new model continue the posture without retraining. |

**Authority account and doctrine (Phase D):**

| ID | kind | state | terms |
|----|------|-------|-------|
| authority | commitment, `standing: true` | STANDING | The authority account: the ledger of grant and revoke postings and the chain of authorization from genesis forward. |
| AU-1 | commitment | OPEN | Immutability: nothing written ever changes; authority changes only by new postings. |
| AU-2 | commitment | OPEN | One genesis: exactly one self-authorizing genesis grant, where author equals grantee, role owner, content.genesis true, no empowering predecessor. |
| AU-3 | commitment | OPEN | Chain to genesis: every non-genesis grant or revoke is authored by an identity whose authority chains back to genesis and cites the empowering grant as predecessor. |
| AU-4 | commitment | OPEN | Prospective only: an authority change never alters the effect of earlier entries; effect is derived by walking forward to each posting's position. |
| AU-5 | commitment | OPEN | The author rule is kernel law (settlement needs distinct fulfiller and verifier); above the floor, succession shape, role definitions, and revocation rules are owner-set recorded policy, and a policy change is a top-level act governed by the currently-effective policy. |

The five AU terms above are the five floor/policy rules of §8 stated as account terms;
AU-1…AU-4 are the first four floor rules, and AU-5 carries the fifth (author rule) plus
the owner-set-policy doctrine. Do not split them differently.

---

## Appendix B — Cold-start posting sequence (normative order)

The full ordered sequence of cold-start postings. Authors: `founder` for Phases A, C, D;
`builder` for Phase B. Use real timestamps in journal order. IDs for the non-account
postings (registers, amendments, fulfills, verifies, the closing annotation) are yours to
choose, but they must be unique and referenced consistently.

**Phase A (founder):**
1. `open` chart declaration (`["chart"]`, standing, account_kinds + posting_kinds, no account_kind).
2. `open` × 8 — P-1…P-8 (standing commitments).
3. `register` — founding document `D-books`.
4. `open` × 6 — K-1…K-6 (commitments, open).
5. `open` × 8 — D-1…D-8 (commitments, open, `deferred: true` + rationale).

**Phase B (builder, solo-bootstrap overrides):**
6. `register` × N — every artifact produced (journal store, codec, derivation, rendering, posting interface, verifier).
7. For each of K-1…K-6: a `fulfill` (citing the artifact voucher) then a `verify` (`accepted`, `override_reason: "solo bootstrap"`). The journal must pass the verifier at every prefix; running it once on the complete journal is sufficient.
8. `annotate` — closing bookmark (instance exists, kernel settled, verifier passes, books remain open).

**Phase C (founder):**
9. `amend` on `["chart"]` — `add_account_kinds: ["board"]`, rationale, predecessor the chart declaration.
10. `open` — BD-1 (commitment). 11. `open` — BD-2 (commitment).

**Phase D (founder):**
12. `amend` on `["chart"]` — `add_posting_kinds: ["grant","revoke"]`, rationale, predecessor the chart declaration (not the step 9 amendment — chart amendments are parallel extensions of the original declaration, not a chain).
13. `register` — register the authority section (or your authority work order) as a document `D-authority`. This step is **required**, not optional; the AU openings cite it as their voucher.
14. `open` — the `authority` account (commitment, `standing: true`), citing `D-authority` as voucher.
15. `open` × 5 — AU-1…AU-5 (commitments, open), each citing `D-authority` as voucher.

After step 15 the instance is built and **unclaimed**. Run the verifier on the whole
journal; it must PASS. The genesis grant (§9) is a separate, post-build, human act.
