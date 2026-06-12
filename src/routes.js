/**
 * K-5: Posting interface (REST endpoints)
 *
 * An actor can submit a posting and have it land in the journal.
 * Reject only on canonical well-formedness (P-4). Nothing else rejected at capture.
 */

const express = require("express");
const journal = require("./journal");
const { derive } = require("./derive");
const { render } = require("./render");

const router = express.Router();

/**
 * POST /postings - Submit a posting to the journal.
 * Rejects only on canonical well-formedness (P-4).
 */
router.post("/postings", (req, res) => {
  try {
    const posting = journal.append(req.body);
    res.status(201).json({ ok: true, posting });
  } catch (err) {
    if (err.validationErrors) {
      res.status(400).json({ ok: false, errors: err.validationErrors });
    } else {
      res.status(500).json({ ok: false, errors: [err.message] });
    }
  }
});

/**
 * GET /journal - Export the full journal as canonical/1.
 */
router.get("/journal", (req, res) => {
  res.type("text/plain").send(journal.exportCanonical());
});

/**
 * GET /state - Derived state (account balances).
 */
router.get("/state", (req, res) => {
  const postings = journal.read();
  const accounts = derive(postings);
  res.json(accounts);
});

/**
 * GET /audit - Audit rendering (deterministic, human-legible).
 */
router.get("/audit", (req, res) => {
  const postings = journal.read();
  const accounts = derive(postings);
  res.type("text/plain").send(render(accounts));
});

module.exports = router;
