/**
 * K-4: Audit rendering
 *
 * Deterministic, human-legible, byte-stable rendering of derived state.
 * Same journal in -> byte-identical rendering out.
 * Must match verify.py render() exactly. No LLM participates.
 */

/**
 * Render derived accounts to a deterministic audit string.
 * Faithfully ports verify.py render() logic.
 */
function render(accounts) {
  const lines = ["INTENT ACCOUNTING - DERIVED STATE", ""];

  const sections = [
    ["STANDING", "Standing accounts"],
    ["OPEN", "Open accounts"],
    ["SETTLED", "Settled accounts"],
  ];

  for (const [state, title] of sections) {
    const rows = Object.keys(accounts)
      .filter((k) => accounts[k].state === state)
      .sort();

    lines.push(`${title} (${rows.length}):`);

    for (const k of rows) {
      const a = accounts[k];
      // Collapse whitespace in terms, same as Python " ".join(str(terms).split())
      let terms = String(a.terms).split(/\s+/).join(" ");
      if (terms.length > 100) {
        terms = terms.substring(0, 97) + "...";
      }

      let suffix = "";
      if (a.settled_by) {
        suffix = `  [fulfill ${a.settled_by[0]} / verify ${a.settled_by[1]}]`;
      }

      // Python: "  %-28s %-10s %s%s" % (k, a["kind"], terms, suffix)
      lines.push(`  ${k.padEnd(28)} ${a.kind.padEnd(10)} ${terms}${suffix}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

module.exports = { render };
