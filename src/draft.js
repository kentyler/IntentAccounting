/**
 * W-2: Conversational drafting endpoint
 *
 * Takes plain-text human input, reads current derived state, and asks an LLM
 * to draft canonical postings. Returns drafts for human confirmation.
 * The LLM never submits -- only confirmed postings go through K-5.
 *
 * Provider: ANTHROPIC_API_KEY or OPENAI_API_KEY, selected by LLM_PROVIDER env var.
 * Defaults to anthropic if ANTHROPIC_API_KEY is set, else openai.
 */

const journal = require("./journal");
const { derive } = require("./derive");

function getProvider() {
  const explicit = process.env.LLM_PROVIDER;
  if (explicit === "openai") return "openai";
  if (explicit === "anthropic") return "anthropic";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

function buildSystemPrompt(accounts, postings, documents) {
  const standing = Object.entries(accounts)
    .filter(([, a]) => a.state === "STANDING")
    .map(([id, a]) => `  ${id}: ${a.terms}`)
    .join("\n");

  const open = Object.entries(accounts)
    .filter(([, a]) => a.state === "OPEN")
    .map(([id, a]) => `  ${id} (${a.kind}): ${a.terms}`)
    .join("\n");

  const settled = Object.entries(accounts)
    .filter(([, a]) => a.state === "SETTLED")
    .map(([id, a]) => `  ${id}: settled by ${a.settled_by[0]} / ${a.settled_by[1]}`)
    .join("\n");

  const docList = documents
    .map((d) => `  ${d.doc_id} (${d.doc_type}): ${d.location}`)
    .join("\n");

  // Find pending fulfillments (fulfills on OPEN accounts with no accepted verify yet)
  const pendingFulfills = postings
    .filter((p) => p.kind === "fulfill")
    .filter((p) => p.accounts.some((a) => accounts[a] && accounts[a].state === "OPEN"))
    .map((p) => `  ${p.id} on ${p.accounts.join(", ")} by ${p.author}`)
    .join("\n");

  // Find all posting IDs for reference validation
  const postingIds = postings.map((p) => p.id);
  const lastId = postingIds[postingIds.length - 1];

  return `You are a drafting assistant for an Intent Accounting instance. You draft canonical postings from plain-text human input. You NEVER submit postings yourself -- you only produce drafts for the human to confirm.

CURRENT STATE:

Standing accounts (constitution):
${standing || "  (none)"}

Open accounts (work to do):
${open || "  (none)"}

Settled accounts (completed):
${settled || "  (none)"}

Registered documents:
${docList || "  (none)"}

Pending fulfillments awaiting verification:
${pendingFulfills || "  (none)"}

Last posting id in journal: ${lastId}
Total postings: ${postings.length}

POSTING KINDS: open, register, fulfill, verify, reverse, amend, annotate

ACCOUNT KINDS: commitment, gap, relation

RULES:
1. Draft postings as JSON objects with ALL required fields: id, kind, author, at, accounts, vouchers, predecessors, content, grammar
2. Set grammar to "canonical/1" always
3. Set author to "CONFIRMER" -- the surface will replace this with the actual human's name
4. Generate unique ids -- use a descriptive prefix like "open-", "fulfill-", "verify-", "ann-", "reg-" followed by a meaningful suffix
5. Set "at" to the current ISO timestamp (use the one provided in the user message)
6. For fulfill postings: vouchers must reference registered document ids. Add content.drafted_by with your model name.
7. For verify postings: predecessors must reference the fulfill posting being verified. Add content.drafted_by.
8. For open postings: content must include account_kind and terms. For commitments, terms must be non-empty.
9. If the input is too ambiguous to draft the intended posting, draft a gap posting (kind: "open", account_kind: "gap") carrying everything stated, so nothing is lost.
10. Add content.drafted_by to every posting with your model identifier.
11. One utterance may yield multiple postings. Return each as a separate object.

RESPOND WITH ONLY a JSON array of posting objects. No explanation, no markdown fences, just the JSON array. If you need to ask a clarifying question, return a single-element array with a posting of kind "annotate" whose content.text contains your question, and content.is_clarification set to true.`;
}

async function callAnthropic(systemPrompt, userMessage) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.content[0].text;
  return text;
}

async function callOpenAI(systemPrompt, userMessage) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

/**
 * Draft postings from natural language input.
 * Returns { drafts: [...postings], provider, clarification? }
 */
async function draft(input, context) {
  const provider = getProvider();
  if (!provider) {
    throw new Error("No LLM provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.");
  }

  const postings = journal.read();
  const accounts = derive(postings);

  // Collect registered documents
  const documents = postings
    .filter((p) => p.kind === "register" && p.content.document)
    .map((p) => p.content.document);

  const systemPrompt = buildSystemPrompt(accounts, postings, documents);

  // Build user message with timestamp and optional context
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  let userMessage = `Current time: ${now}\n\n`;
  if (context) {
    userMessage += `Context (pre-seeded from browse surface): ${context}\n\n`;
  }
  userMessage += `Human says: ${input}`;

  let raw;
  if (provider === "anthropic") {
    raw = await callAnthropic(systemPrompt, userMessage);
  } else {
    raw = await callOpenAI(systemPrompt, userMessage);
  }

  // Parse the JSON response -- strip markdown fences if model included them
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let drafts;
  try {
    drafts = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`LLM returned invalid JSON: ${e.message}\n\nRaw: ${raw}`);
  }

  if (!Array.isArray(drafts)) {
    drafts = [drafts];
  }

  // Check for clarification
  const clarification = drafts.find(
    (d) => d.kind === "annotate" && d.content && d.content.is_clarification
  );

  return {
    drafts,
    provider,
    clarification: clarification ? clarification.content.text : null,
  };
}

/**
 * Mount the draft endpoint on an Express router.
 */
function mountDraft(app) {
  const express = require("express");

  app.post("/draft", express.json(), async (req, res) => {
    try {
      const { input, context } = req.body;
      if (!input || typeof input !== "string") {
        return res.status(400).json({ ok: false, error: "input is required" });
      }

      const result = await draft(input, context);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { draft, mountDraft };
