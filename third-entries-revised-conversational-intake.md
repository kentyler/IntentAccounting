# Third Entries, Revised: The Conversational Posting Surface

This work order supersedes the task-shaped forms version of W-2. If W-2 was already
opened in the journal, post an `amend` against it citing this document, with rationale:
"the form-based bridge was speculative for an instance with one conversant operator;
the conversational destination was directly buildable." If W-2 was not yet opened,
register this document and open W-2 from it directly. Either way the change of mind
enters the books, which is how design decisions should be allowed to die.

Constitutional note, unchanged: this surface is a client of the posting interface
(K-5), never a second write surface. W-1 remains read-only and must satisfy its own
terms with this component removed.

---

## Account W-2: Conversational posting surface

Kind: commitment

Terms (each independently checkable):

1. One write path, human-gated. Every submission flows through K-5 and lands in the
   journal indistinguishable from any other actor's posting. The drafting LLM never
   submits: only a posting explicitly confirmed by the human is submitted, with no
   exceptions and no batching that hides individual postings from confirmation.

2. Ordinary language in. The human expresses what they want in plain text. The LLM
   drafts the canonical posting or postings. It may ask one or two clarifying
   questions, but it may not refuse messy, partial, or casual input (P-4); input too
   ambiguous to draft as intended becomes a drafted gap posting carrying everything
   stated, offered for confirmation like any other draft.

3. The confirmation is the surface. Before submission, the human sees each draft
   posting as it will land: kind, addressed accounts, full content, and every
   reference rendered human-legibly (account names and current terms, not bare ids),
   with approve, edit, and discard available per posting. Discarded drafts never
   touch the journal.

4. Authorship belongs to the confirmer. The author field of every landed posting is
   the confirming human. The drafting model is recorded in content (drafted_by).
   In particular, verify postings carry the human as author: no agent may acquire
   verification authority by drafting on a human's behalf.

5. References resolve at draft time. The drafter reads current derived state before
   drafting, so that accounts, predecessors, and vouchers it cites exist. The K-5
   boundary still enforces canonical well-formedness regardless (P-4); this term is
   about draft quality, not boundary policy.

6. The journal echo. After landing, the surface shows the posting as it actually
   landed, with its id, and links to its location on the browse surface. No success
   message without the journal echo.

7. The loop with W-1. Browse-surface pages link into this surface with pre-seeded
   context: a pending fulfillment links to "verify this," an open account to
   "fulfill this" and "note on this," with the relevant ids and content already in
   the drafting context so the human's utterance can be as short as a verdict.

8. The supersession tripwire, carried over. Self-declared identity at confirmation
   is sufficient at current trust scale (one trusted operator). The day a second
   human whose honesty the operator cannot vouch for can reach this surface, an
   authentication account falls due, because self-declared authorship makes the
   author rule (P-6) spoofable.

9. Stock browser, no installation. The drafting model, its provider, the transport,
   and all other technology choices belong to the settling actor (P-1).

---

## Annotation (advisory, not terms)

- A single text box with a draft-and-confirm cycle beats a chat widget for the first
  settlement. Conversation state machinery is not needed when one utterance yields
  drafts and edits happen on the confirmation screen; build the chat only if the
  single-shot version proves insufficient in use.
- One utterance may legitimately yield several postings - "back up the journal worries
  me, open an account for it and register the rsync script" is an open plus a
  register. Show them as a set, confirmable individually.
- The verify path seeded from W-1 is still the most important interaction on the
  surface, and with pre-seeded context it approaches its ideal cost: read the
  fulfillment, type "accepted, looks right," confirm the rendered posting. One
  sentence and one click.
- The gap-drafting behavior in term 2 deserves gentle prominence in the interface:
  when the system answers ambiguity with "I've drafted this as a gap," the human
  learns the house style - nothing is lost, nothing is forced, unease has a place to
  live.
- This surface is the prototype of the shoebox intake. What the operator of this
  instance experiences here - say it plainly, see it precisely, confirm it cheaply -
  is what the small-business owner is eventually offered. Design decisions made here
  should be made remembering that second audience.
