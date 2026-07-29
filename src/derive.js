/**
 * K-3: Derivation
 *
 * Derives account balances (STANDING, OPEN, DISCHARGED) and current terms
 * from the journal alone. Must agree exactly with the verifier's derivation.
 *
 * Nobody writes a balance (P-6). Status is derived from postings.
 *
 * Presentment vocabulary (verify-2.py): present aliases fulfill, accept
 * aliases verify. DISCHARGED replaces SETTLED. OPEN accounts carry
 * presentment_condition (never_presented, presented_awaiting,
 * dishonored_unprotested, dishonored_protested).
 *
 * W-3 addition: deriveChart - the current chart (account kinds, posting kinds)
 * derived from the journal alone: the chart declaration (first posting) plus
 * chart amendments, walked in journal order exactly as the verifier walks them.
 * The kernel kinds are the floor the chart must include, never the ceiling.
 */

const KERNEL_POSTING_KINDS = [
  "open", "register", "fulfill", "verify", "reverse", "amend", "annotate",
];
const KERNEL_ACCOUNT_KINDS = ["commitment", "gap", "relation"];

/**
 * Derive the current chart from an array of postings.
 * Mirrors the verifier's walk: the chart declaration seeds the sets,
 * amend postings on ["chart"] extend them. Returns
 * { account_kinds: Set, posting_kinds: Set }.
 */
function deriveChart(postings) {
  const account_kinds = new Set(KERNEL_ACCOUNT_KINDS);
  const posting_kinds = new Set(KERNEL_POSTING_KINDS);
  for (const p of postings) {
    if (p.kind === "open" && Array.isArray(p.accounts) && p.accounts[0] === "chart") {
      for (const k of p.content.account_kinds || []) account_kinds.add(k);
      for (const k of p.content.posting_kinds || []) posting_kinds.add(k);
    }
    if (p.kind === "amend" && Array.isArray(p.accounts) && p.accounts.includes("chart")) {
      for (const k of p.content.add_account_kinds || []) account_kinds.add(k);
      for (const k of p.content.add_posting_kinds || []) posting_kinds.add(k);
    }
  }
  return { account_kinds, posting_kinds };
}

/**
 * Derive account state from an array of postings.
 * Returns a Map-like object: account_id ->
 *   { state, kind, terms, settled_by, settled_by_kinds, presentment_condition }
 *
 * Faithfully ports verify-2.py derive() logic.
 */
function derive(postings) {
  const byId = {};
  for (const p of postings) {
    byId[p.id] = p;
  }

  // A posting is reversed if any reverse posting cites it.
  const reversedIds = new Set();
  for (const p of postings) {
    if (p.kind === "reverse") {
      for (const pred of p.predecessors) {
        reversedIds.add(pred);
      }
    }
  }

  const live = postings.filter((p) => !reversedIds.has(p.id));

  // Build accounts from open postings
  const accounts = {};
  for (const p of live) {
    if (p.kind !== "open") continue;
    const acct = p.accounts[0];
    if (acct == null) continue;

    let terms = p.content.terms || "";

    // Apply unreversed amendments in journal order
    for (const a of live) {
      if (a.kind === "amend" && a.accounts.includes(acct) && "terms" in a.content) {
        terms = a.content.terms;
      }
    }

    const standing = !!p.content.standing;
    accounts[acct] = {
      kind: p.content.account_kind || "commitment",
      terms: terms,
      state: standing ? "STANDING" : "OPEN",
      settled_by: null,
      settled_by_kinds: null,
    };
  }

  // Discharge scan: accepted verify/accept with valid fulfill/present predecessors
  for (const v of live) {
    if ((v.kind !== "verify" && v.kind !== "accept") || v.content.verdict !== "accepted") continue;

    for (const r of v.predecessors) {
      const f = byId[r];
      if (!f || (f.kind !== "fulfill" && f.kind !== "present") || reversedIds.has(f.id)) continue;

      // Author rule: distinct authors or override
      if (f.author === v.author && !v.content.override_reason) continue;

      for (const acct of f.accounts) {
        const a = accounts[acct];
        if (a && a.state === "OPEN") {
          a.state = "DISCHARGED";
          a.settled_by = [f.id, v.id];
          a.settled_by_kinds = [f.kind, v.kind];
        }
      }
    }
  }

  // Presentment condition for OPEN accounts
  for (const [acctId, a] of Object.entries(accounts)) {
    if (a.state !== "OPEN") {
      a.presentment_condition = null;
      continue;
    }

    const presentments = live.filter(
      (p) => (p.kind === "fulfill" || p.kind === "present") && p.accounts.includes(acctId)
    );
    if (presentments.length === 0) {
      a.presentment_condition = "never_presented";
      continue;
    }

    const presentmentIds = new Set(presentments.map((p) => p.id));
    const dishonors = live.filter(
      (p) => p.kind === "dishonor" && p.predecessors.some((pred) => presentmentIds.has(pred))
    );
    if (dishonors.length === 0) {
      a.presentment_condition = "presented_awaiting";
      continue;
    }

    const dishonorIds = new Set(dishonors.map((p) => p.id));
    const protests = live.filter(
      (p) => p.kind === "protest" && p.predecessors.some((pred) => dishonorIds.has(pred))
    );
    a.presentment_condition = protests.length > 0 ? "dishonored_protested" : "dishonored_unprotested";
  }

  return accounts;
}

module.exports = { derive, deriveChart, KERNEL_POSTING_KINDS, KERNEL_ACCOUNT_KINDS };
