/**
 * K-1: Journal store
 *
 * Append-only flat-file journal. Never modifies or deletes.
 * The journal is the truth (P-7).
 */

const fs = require("fs");
const path = require("path");
const { validate, serialize, REQUIRED_FIELDS } = require("./codec");
const { deriveChart } = require("./derive");

// Overridable for tests and secondary instances; defaults to the instance journal.
const JOURNAL_PATH =
  process.env.JOURNAL_PATH || path.join(__dirname, "..", "journal.jsonl");

/**
 * Append one posting to the journal. Validates canonical well-formedness
 * first (P-4: reject only on form). Returns the posting on success.
 * Throws on validation failure.
 *
 * W-3: well-formedness at capture matches the verifier's C-1 and C-3 --
 * 1. duplicate ids are rejected (C-1 counts unique ids as well-formedness;
 *    without this check the sole write surface can put the journal into a
 *    state the verifier rejects);
 * 2. the posting kind is checked against the chart DERIVED FROM THE JOURNAL
 *    (declaration plus amendments), never against a hardcoded set -- the
 *    chart is amendable, and capture must not strangle a lawful chart
 *    amendment (P-1). The kernel kinds are the floor, not the ceiling.
 */
function append(posting) {
  const errors = validate(posting);

  const existing = read();

  if (errors.length === 0) {
    // C-1: unique ids are canonical well-formedness
    if (existing.some((p) => p.id === posting.id)) {
      errors.push(`duplicate id ${JSON.stringify(posting.id)}: an earlier posting carries it`);
    }
    // C-3: kind must be in the chart as derived from the journal.
    // On an empty journal only the chart declaration itself can land,
    // and its kind ("open") is in the kernel floor.
    const chart = deriveChart(existing);
    if (!chart.posting_kinds.has(posting.kind)) {
      errors.push(`kind ${JSON.stringify(posting.kind)} is not in the chart (chart is amendable: amend ["chart"] with add_posting_kinds)`);
    }
  }

  if (errors.length > 0) {
    const err = new Error("Posting rejected: " + errors.join("; "));
    err.validationErrors = errors;
    throw err;
  }

  // Canonical key order
  const ordered = {};
  for (const key of REQUIRED_FIELDS) {
    ordered[key] = posting[key];
  }
  const line = JSON.stringify(ordered) + "\n";

  // Append with fsync for durability
  const fd = fs.openSync(JOURNAL_PATH, "a");
  fs.writeSync(fd, line);
  fs.fsyncSync(fd);
  fs.closeSync(fd);

  return ordered;
}

/**
 * Read all postings from the journal file.
 * Returns an array of posting objects.
 */
function read() {
  if (!fs.existsSync(JOURNAL_PATH)) {
    return [];
  }
  const text = fs.readFileSync(JOURNAL_PATH, "utf-8");
  const postings = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    postings.push(JSON.parse(line));
  }
  return postings;
}

/**
 * Export the full journal as canonical/1 text.
 */
function exportCanonical() {
  const postings = read();
  return serialize(postings);
}

/**
 * Get the path to the journal file.
 */
function journalPath() {
  return JOURNAL_PATH;
}

module.exports = { append, read, exportCanonical, journalPath };
