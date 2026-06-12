# Second Entries: The Browse Surface

Work order for a running Intent Accounting instance. The settling LLM should register
this document, transcribe the account below as an open posting citing this document,
post the annotation, and then settle the account by its own design choices (P-1).
Fulfillment cites the produced artifacts as registered documents. Verification this
time should be performed by the human operator - the instance now has two actors, and
the author rule (P-6) can be satisfied without an override for the first time.

---

## Account W-1: Human browse surface

Kind: commitment

Terms (each independently checkable):

1. Read-only. The surface provides no path that writes to the journal. All mutation
   continues to flow exclusively through the posting interface (K-5). The surface may
   display how to post; it may never post.

2. Derived from the journal alone. The entire surface is generated from the journal;
   regenerating from the same journal yields an equivalent site. No hand-authored
   content exists outside the books - anything worth saying on the surface is worth
   posting first.

3. Total coverage. Every account, every posting, and every registered document is
   addressable at a stable URL or anchor derived from its id, so that any of them can
   be cited in conversation by link.

4. Provenance on every fact. Every rendered statement - a state, a term, a settlement
   - links to the posting or postings it derives from. No claim on the surface
   without a journal reference behind it. The warrant travels into the rendering.

5. Orientation. An index page renders the derived state: standing accounts (the
   constitution), open accounts (the work), settled accounts (the record), and gaps
   (the stuck), with counts, plus the most recent bookmark annotation so an arriving
   human is oriented the same way an arriving LLM is.

6. Legible to the untrained. A human with no knowledge of this system can, within a
   few minutes of browsing, answer: what is this system committed to, what is it
   working on, what has it finished and on what evidence, and what is it stuck on.

7. Stock browser. The surface is HTML browsable in an ordinary browser with no
   installation. Everything else - static or served, framework or none, styling,
   search - is the settling actor's choice.

---

## Annotation (advisory, not terms)

Guidance the settling actor may take or leave:

- Static regeneration on journal append is the simplest expression that satisfies
  term 2, and it makes term 1 trivially true.
- Account pages read well as: kind and state at top; current terms with their
  amendment history; the timeline of postings against the account; cited documents;
  then annotations rendered as accreting marginalia in journal order - the reading
  trail made visible, never collapsed.
- Posting content and terms benefit from markdown rendering; the journal stores the
  text, the surface dignifies it.
- The constitution makes a good front page beneath the orientation index: a system
  that shows its commitments before its activity makes the right first impression on
  a human, and says something true about its priorities.
- Client-side search over a generated index is enough; nothing requires a server.
- Resist the temptation to add an edit button later. The day the surface writes is
  the day there are two truths.
