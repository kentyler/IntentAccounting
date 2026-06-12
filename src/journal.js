/**
 * K-1: Journal store
 *
 * Append-only flat-file journal. Never modifies or deletes.
 * The journal is the truth (P-7).
 */

const fs = require("fs");
const path = require("path");
const { validate, serialize, REQUIRED_FIELDS } = require("./codec");

const JOURNAL_PATH = path.join(__dirname, "..", "journal.jsonl");

/**
 * Append one posting to the journal. Validates canonical well-formedness
 * first (P-4: reject only on form). Returns the posting on success.
 * Throws on validation failure.
 */
function append(posting) {
  const errors = validate(posting);
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
