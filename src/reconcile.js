/**
 * W-4: Reconciliation surface
 *
 * The trial balance beyond the audit rendering. Derived from the journal
 * alone; writes nothing; deterministic -- same journal in, same report out.
 *
 * Reports:
 *   open_without_fulfill      open accounts with no live fulfill activity
 *   fulfills_awaiting_verify  live fulfills on OPEN accounts with no settling
 *                             verification yet (the distinct-author queue)
 *   gap_accounts_open         gap accounts outstanding
 *   unreadable_candidates     non-settled accounts whose CURRENT terms cite
 *                             reversed postings or settled accounts --
 *                             candidates for re-reading, not verdicts
 *
 * This is coherence-by-reconciliation given a surface: no position rises
 * above the projections; the report only says where they have not yet met.
 */

const { derive } = require("./derive");
const { deriveBoards } = require("./boards");

/** True when `terms` mentions `id` as a whole token. */
function mentions(terms, id) {
  if (!terms || !id) return false;
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(^|[^A-Za-z0-9_-])" + escaped + "($|[^A-Za-z0-9_-])").test(terms);
}

/**
 * Build the reconciliation report from an array of postings.
 * Deterministic: all lists sorted.
 */
function reconcile(postings) {
  const accounts = derive(postings);

  const reversedIds = new Set();
  for (const p of postings) {
    if (p.kind === "reverse") for (const r of p.predecessors) reversedIds.add(r);
  }
  const live = postings.filter((p) => !reversedIds.has(p.id));

  const openWithoutFulfill = [];
  for (const [id, a] of Object.entries(accounts)) {
    if (a.state !== "OPEN") continue;
    const has = live.some((p) => p.kind === "fulfill" && p.accounts.includes(id));
    if (!has) openWithoutFulfill.push(id);
  }
  openWithoutFulfill.sort();

  const fulfillsAwaitingVerify = [];
  for (const f of live) {
    if (f.kind !== "fulfill") continue;
    const openAccts = f.accounts.filter((a) => accounts[a] && accounts[a].state === "OPEN");
    if (openAccts.length === 0) continue;
    fulfillsAwaitingVerify.push({ fulfill: f.id, author: f.author, accounts: openAccts.slice().sort() });
  }
  fulfillsAwaitingVerify.sort((x, y) => (x.fulfill < y.fulfill ? -1 : x.fulfill > y.fulfill ? 1 : 0));

  const gapAccountsOpen = Object.entries(accounts)
    .filter(([, a]) => a.kind === "gap" && a.state === "OPEN")
    .map(([id]) => id)
    .sort();

  const settledIds = Object.entries(accounts)
    .filter(([, a]) => a.state === "SETTLED")
    .map(([id]) => id);
  const unreadableCandidates = [];
  for (const [id, a] of Object.entries(accounts)) {
    if (a.state === "SETTLED") continue;
    const references = [];
    for (const rid of [...reversedIds].sort()) {
      if (mentions(a.terms, rid)) references.push({ ref: rid, why: "reversed posting" });
    }
    for (const sid of settledIds.sort()) {
      if (sid !== id && mentions(a.terms, sid)) references.push({ ref: sid, why: "settled account" });
    }
    if (references.length > 0) unreadableCandidates.push({ account: id, state: a.state, references });
  }
  unreadableCandidates.sort((x, y) => (x.account < y.account ? -1 : x.account > y.account ? 1 : 0));

  // Board diagnostics
  const boardState = deriveBoards(postings, accounts);
  const board_diagnostics = boardState.diagnostics;

  return {
    postings: postings.length,
    open_without_fulfill: openWithoutFulfill,
    fulfills_awaiting_verify: fulfillsAwaitingVerify,
    gap_accounts_open: gapAccountsOpen,
    unreadable_candidates: unreadableCandidates,
    board_diagnostics,
  };
}

module.exports = { reconcile };
