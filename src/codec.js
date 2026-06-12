/**
 * K-2: Canonical codec (canonical/1)
 *
 * Parse and serialize postings in canonical/1 format: UTF-8 text file of
 * JSON objects, one per line, in append order.
 *
 * Round-trip law:
 *   parse(serialize(postings)) === identity on canonical tuple
 *   serialize(parse(text)) === identity on bytes modulo insignificant whitespace
 */

const REQUIRED_FIELDS = [
  "id", "kind", "author", "at", "accounts",
  "vouchers", "predecessors", "content", "grammar",
];

const POSTING_KINDS = new Set([
  "open", "register", "fulfill", "verify", "reverse", "amend", "annotate",
]);

/**
 * Parse canonical/1 text into an array of posting objects.
 * Returns { postings, errors }.
 */
function parse(text) {
  const postings = [];
  const errors = [];
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const lineNum = i + 1;

    let obj;
    try {
      obj = JSON.parse(line);
    } catch (e) {
      errors.push(`line ${lineNum}: not valid JSON (${e.message})`);
      continue;
    }

    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
      errors.push(`line ${lineNum}: posting must be a JSON object`);
      continue;
    }

    const missing = REQUIRED_FIELDS.filter((f) => !(f in obj));
    if (missing.length > 0) {
      errors.push(`line ${lineNum}: missing fields: ${missing.sort().join(", ")}`);
      continue;
    }

    for (const field of ["accounts", "vouchers", "predecessors"]) {
      if (!Array.isArray(obj[field])) {
        errors.push(`line ${lineNum}: ${field} must be an array`);
      }
    }

    if (typeof obj.content !== "object" || obj.content === null || Array.isArray(obj.content)) {
      errors.push(`line ${lineNum}: content must be an object`);
    }

    postings.push(obj);
  }

  return { postings, errors };
}

/**
 * Serialize an array of posting objects to canonical/1 text.
 * Each posting becomes one JSON line with deterministic key order.
 */
function serialize(postings) {
  const lines = postings.map((p) => {
    // Canonical key order matches REQUIRED_FIELDS
    const ordered = {};
    for (const key of REQUIRED_FIELDS) {
      ordered[key] = p[key];
    }
    return JSON.stringify(ordered);
  });
  return lines.join("\n") + "\n";
}

/**
 * Validate a single posting object for canonical well-formedness.
 * Returns an array of error strings (empty = valid).
 */
function validate(posting) {
  const errors = [];

  const missing = REQUIRED_FIELDS.filter((f) => !(f in posting));
  if (missing.length > 0) {
    errors.push(`missing fields: ${missing.sort().join(", ")}`);
    return errors;
  }

  if (typeof posting.id !== "string" || !posting.id) {
    errors.push("id must be a non-empty string");
  }
  if (!POSTING_KINDS.has(posting.kind)) {
    errors.push(`kind ${JSON.stringify(posting.kind)} is not a recognized posting kind`);
  }
  if (typeof posting.author !== "string" || !posting.author) {
    errors.push("author must be a non-empty string");
  }
  if (typeof posting.at !== "string" || !posting.at) {
    errors.push("at must be a non-empty string");
  }

  for (const field of ["accounts", "vouchers", "predecessors"]) {
    if (!Array.isArray(posting[field])) {
      errors.push(`${field} must be an array`);
    }
  }

  if (typeof posting.content !== "object" || posting.content === null || Array.isArray(posting.content)) {
    errors.push("content must be an object");
  }

  if (typeof posting.grammar !== "string" || !posting.grammar) {
    errors.push("grammar must be a non-empty string");
  }

  return errors;
}

module.exports = { parse, serialize, validate, REQUIRED_FIELDS, POSTING_KINDS };
