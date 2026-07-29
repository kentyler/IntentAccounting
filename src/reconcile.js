/**
 * W-4: Reconciliation surface
 *
 * The trial balance beyond the audit rendering. Derived from the journal
 * alone; writes nothing; deterministic -- same journal in, same report out.
 *
 * Reports:
 *   open_without_presentment      open accounts with no live fulfill/present
 *   presentments_awaiting_acceptance  live fulfills/presents on OPEN accounts
 *                                     with no settling verification yet
 *   gap_accounts_open              gap accounts outstanding
 *   unreadable_candidates          non-discharged accounts whose terms cite
 *                                  reversed postings or discharged accounts
 *   dishonored_commitments         open accounts with dishonored presentments
 *   protested_dishonors            dishonors escalated to boards
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
  const byId = {};
  for (const p of postings) byId[p.id] = p;

  // Open accounts with no live presentment (fulfill or present)
  const openWithoutPresentment = [];
  for (const [id, a] of Object.entries(accounts)) {
    if (a.state !== "OPEN") continue;
    const has = live.some((p) => (p.kind === "fulfill" || p.kind === "present") && p.accounts.includes(id));
    if (!has) openWithoutPresentment.push(id);
  }
  openWithoutPresentment.sort();

  // Live presentments (fulfill or present) on OPEN accounts awaiting acceptance
  const presentmentsAwaitingAcceptance = [];
  for (const f of live) {
    if (f.kind !== "fulfill" && f.kind !== "present") continue;
    const openAccts = f.accounts.filter((a) => accounts[a] && accounts[a].state === "OPEN");
    if (openAccts.length === 0) continue;
    presentmentsAwaitingAcceptance.push({
      presentment: f.id,
      kind: f.kind,
      author: f.author,
      accounts: openAccts.slice().sort(),
    });
  }
  presentmentsAwaitingAcceptance.sort((x, y) =>
    x.presentment < y.presentment ? -1 : x.presentment > y.presentment ? 1 : 0
  );

  const gapAccountsOpen = Object.entries(accounts)
    .filter(([, a]) => a.kind === "gap" && a.state === "OPEN")
    .map(([id]) => id)
    .sort();

  // Unreadable candidates: non-discharged accounts citing reversed postings or discharged accounts
  const dischargedIds = Object.entries(accounts)
    .filter(([, a]) => a.state === "DISCHARGED")
    .map(([id]) => id);
  const unreadableCandidates = [];
  for (const [id, a] of Object.entries(accounts)) {
    if (a.state === "DISCHARGED") continue;
    const references = [];
    for (const rid of [...reversedIds].sort()) {
      if (mentions(a.terms, rid)) references.push({ ref: rid, why: "reversed posting" });
    }
    for (const sid of dischargedIds.sort()) {
      if (sid !== id && mentions(a.terms, sid)) references.push({ ref: sid, why: "discharged account" });
    }
    if (references.length > 0) unreadableCandidates.push({ account: id, state: a.state, references });
  }
  unreadableCandidates.sort((x, y) => (x.account < y.account ? -1 : x.account > y.account ? 1 : 0));

  // Dishonored commitments: open accounts with dishonored presentments
  const dishonoredCommitments = [];
  for (const [id, a] of Object.entries(accounts)) {
    if (a.state !== "OPEN") continue;
    const cond = a.presentment_condition;
    if (cond === "dishonored_unprotested" || cond === "dishonored_protested") {
      dishonoredCommitments.push({ account: id, condition: cond });
    }
  }
  dishonoredCommitments.sort((x, y) => (x.account < y.account ? -1 : x.account > y.account ? 1 : 0));

  // Protested dishonors: dishonors that have been escalated to boards
  const protestedDishonors = [];
  for (const protest of live) {
    if (protest.kind !== "protest") continue;
    const dishonorPreds = protest.predecessors.filter(
      (r) => byId[r] && byId[r].kind === "dishonor"
    );
    const boardAccts = protest.accounts.filter(
      (a) => accounts[a] && accounts[a].kind === "board"
    );
    if (dishonorPreds.length === 1 && boardAccts.length === 1) {
      protestedDishonors.push({
        protest: protest.id,
        dishonor: dishonorPreds[0],
        board: boardAccts[0],
        author: protest.author,
      });
    }
  }
  protestedDishonors.sort((x, y) => (x.protest < y.protest ? -1 : x.protest > y.protest ? 1 : 0));

  // Board diagnostics
  const boardState = deriveBoards(postings, accounts);
  const board_diagnostics = boardState.diagnostics;

  return {
    postings: postings.length,
    open_without_presentment: openWithoutPresentment,
    presentments_awaiting_acceptance: presentmentsAwaitingAcceptance,
    gap_accounts_open: gapAccountsOpen,
    unreadable_candidates: unreadableCandidates,
    dishonored_commitments: dishonoredCommitments,
    protested_dishonors: protestedDishonors,
    board_diagnostics,
  };
}

module.exports = { reconcile };
