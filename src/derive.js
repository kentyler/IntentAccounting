/**
 * K-3: Derivation
 *
 * Derives account balances (STANDING, OPEN, SETTLED) and current terms
 * from the journal alone. Must agree exactly with the verifier's derivation.
 *
 * Nobody writes a balance (P-6). Status is derived from postings.
 */

/**
 * Derive account state from an array of postings.
 * Returns a Map-like object: account_id -> { state, kind, terms, settled_by }
 *
 * Faithfully ports verify.py derive() logic.
 */
function derive(postings) {
  const byId = {};
  for (const p of postings) {
    byId[p.id] = p;
  }

  // A posting is reversed if any reverse posting cites it.
  // Reversal is final in verifier v1.
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
    };
  }

  // Settlement: find accepted verifications with valid fulfill predecessors
  for (const v of live) {
    if (v.kind !== "verify" || v.content.verdict !== "accepted") continue;

    for (const r of v.predecessors) {
      const f = byId[r];
      if (!f || f.kind !== "fulfill" || reversedIds.has(f.id)) continue;

      // Author rule: distinct authors or override
      if (f.author === v.author && !v.content.override_reason) continue;

      for (const acct of f.accounts) {
        const a = accounts[acct];
        if (a && a.state === "OPEN") {
          a.state = "SETTLED";
          a.settled_by = [f.id, v.id];
        }
      }
    }
  }

  return accounts;
}

module.exports = { derive };
