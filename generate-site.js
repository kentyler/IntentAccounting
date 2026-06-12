#!/usr/bin/env node
/**
 * generate-site.js - W-1: Human browse surface
 *
 * Generates a static HTML site from the journal alone (term 2).
 * Read-only: no write paths (term 1). Total coverage: every account,
 * posting, and document addressable (term 3). Provenance on every fact (term 4).
 * Orientation index (term 5). Legible to untrained (term 6). Stock browser (term 7).
 *
 * Regenerate after any journal append: node generate-site.js
 */

const fs = require("fs");
const path = require("path");
const { derive } = require("./src/derive");

const JOURNAL_PATH = path.join(__dirname, "journal.jsonl");
const PUBLIC = path.join(__dirname, "public");

// --------------- load journal ---------------

function loadJournal() {
  const text = fs.readFileSync(JOURNAL_PATH, "utf-8");
  const postings = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    postings.push(JSON.parse(line));
  }
  return postings;
}

// --------------- markdown-lite ---------------
// Minimal markdown: **bold**, *italic*, `code`, newlines to <br>

function md(text) {
  if (!text) return "";
  let s = String(text);
  s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  s = s.replace(/`(.+?)`/g, "<code>$1</code>");
  s = s.replace(/\n/g, "<br>\n");
  return s;
}

// --------------- HTML helpers ---------------

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function postingLink(id) {
  return `<a href="posting-${esc(id)}.html">${esc(id)}</a>`;
}

function accountLink(id) {
  return `<a href="account-${esc(id)}.html">${esc(id)}</a>`;
}

function stateBadge(state) {
  const colors = { STANDING: "#6b7280", OPEN: "#d97706", SETTLED: "#059669" };
  const color = colors[state] || "#374151";
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${color};color:#fff;font-size:0.85em;font-weight:600;">${state}</span>`;
}

function layout(title, body, breadcrumb) {
  const nav = breadcrumb || `<a href="index.html">Index</a>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} - Intent Accounting</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         line-height: 1.6; color: #1a1a1a; max-width: 900px; margin: 0 auto; padding: 1.5rem; }
  h1 { font-size: 1.6rem; margin-bottom: 0.5rem; }
  h2 { font-size: 1.25rem; margin-top: 1.5rem; margin-bottom: 0.5rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.25rem; }
  h3 { font-size: 1.05rem; margin-top: 1rem; margin-bottom: 0.3rem; }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }
  nav { margin-bottom: 1.5rem; font-size: 0.9rem; color: #6b7280; }
  nav a { color: #6b7280; }
  .terms { background: #f9fafb; border-left: 3px solid #d1d5db; padding: 0.75rem 1rem; margin: 0.5rem 0; }
  .posting-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 0.75rem 1rem; margin: 0.5rem 0; }
  .posting-card .meta { font-size: 0.85rem; color: #6b7280; }
  .annotation { border-left: 3px solid #93c5fd; background: #eff6ff; padding: 0.75rem 1rem; margin: 0.5rem 0; }
  .count { font-size: 0.9rem; color: #6b7280; }
  table { border-collapse: collapse; width: 100%; margin: 0.5rem 0; }
  th, td { text-align: left; padding: 0.4rem 0.75rem; border-bottom: 1px solid #e5e7eb; }
  th { font-weight: 600; font-size: 0.85rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.03em; }
  td { font-size: 0.95rem; }
  .bookmark { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; padding: 0.75rem 1rem; margin: 1rem 0; }
  .bookmark h3 { margin-top: 0; }
  code { background: #f3f4f6; padding: 0.15em 0.3em; border-radius: 3px; font-size: 0.9em; }
  footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; font-size: 0.8rem; color: #9ca3af; }
</style>
</head>
<body>
<nav>${nav}</nav>
${body}
<footer>Intent Accounting instance. Generated from journal (${new Date().toISOString().slice(0, 10)}). Read-only surface.</footer>
</body>
</html>`;
}

// --------------- build index ---------------

function buildIndex(postings, accounts) {
  const standing = Object.entries(accounts).filter(([, a]) => a.state === "STANDING").sort((a, b) => a[0].localeCompare(b[0]));
  const open = Object.entries(accounts).filter(([, a]) => a.state === "OPEN").sort((a, b) => a[0].localeCompare(b[0]));
  const settled = Object.entries(accounts).filter(([, a]) => a.state === "SETTLED").sort((a, b) => a[0].localeCompare(b[0]));

  // Find latest bookmark
  let bookmark = null;
  for (let i = postings.length - 1; i >= 0; i--) {
    if (postings[i].kind === "annotate" && postings[i].content.bookmark) {
      bookmark = postings[i];
      break;
    }
  }

  // Find all documents
  const documents = postings.filter((p) => p.kind === "register");

  let body = `<h1>Intent Accounting</h1>\n<p style="margin-bottom:0.75rem;"><a href="converse.html">Post to the books</a></p>\n`;

  if (bookmark) {
    body += `<div class="bookmark">
<h3>Latest bookmark</h3>
<p>${md(bookmark.content.text)}</p>
<p class="meta" style="font-size:0.85rem;color:#6b7280;margin-top:0.5rem;">
  ${postingLink(bookmark.id)} by ${esc(bookmark.author)} at ${esc(bookmark.at)}
</p></div>\n`;
  }

  // Orientation: counts
  body += `<p class="count">${standing.length} standing, ${open.length} open, ${settled.length} settled, ${postings.length} total postings, ${documents.length} registered documents</p>\n`;

  // Standing accounts (the constitution)
  body += `<h2>Standing accounts (${standing.length})</h2>\n`;
  body += `<p style="font-size:0.9rem;color:#6b7280;">The constitution. These govern until amended.</p>\n`;
  body += accountTable(standing);

  // Open accounts
  body += `<h2>Open accounts (${open.length})</h2>\n`;
  body += accountTable(open);

  // Settled accounts
  body += `<h2>Settled accounts (${settled.length})</h2>\n`;
  body += accountTable(settled, true);

  // Registered documents
  body += `<h2>Registered documents (${documents.length})</h2>\n<table><tr><th>Doc ID</th><th>Type</th><th>Location</th><th>Registered by</th></tr>\n`;
  for (const p of documents) {
    const doc = p.content.document || {};
    body += `<tr>
      <td><a id="doc-${esc(doc.doc_id)}">${esc(doc.doc_id)}</a></td>
      <td>${esc(doc.doc_type || "")}</td>
      <td><code>${esc(doc.location || "")}</code></td>
      <td>${postingLink(p.id)}</td>
    </tr>\n`;
  }
  body += `</table>\n`;

  // All postings timeline
  body += `<h2>Journal timeline (${postings.length} postings)</h2>\n<table><tr><th>#</th><th>ID</th><th>Kind</th><th>Author</th><th>Accounts</th><th>Time</th></tr>\n`;
  postings.forEach((p, i) => {
    body += `<tr>
      <td>${i + 1}</td>
      <td>${postingLink(p.id)}</td>
      <td>${esc(p.kind)}</td>
      <td>${esc(p.author)}</td>
      <td>${p.accounts.map(accountLink).join(", ") || "-"}</td>
      <td style="font-size:0.85rem;">${esc(p.at)}</td>
    </tr>\n`;
  });
  body += `</table>\n`;

  return layout("Index", body, `<strong>Intent Accounting</strong>`);
}

function accountTable(entries, showSettlement) {
  let html = `<table><tr><th>Account</th><th>Kind</th><th>State</th><th>Terms</th>${showSettlement ? "<th>Settled by</th>" : ""}</tr>\n`;
  for (const [id, a] of entries) {
    let terms = String(a.terms || "").split(/\s+/).join(" ");
    if (terms.length > 120) terms = terms.substring(0, 117) + "...";
    let settlementCol = "";
    if (showSettlement && a.settled_by) {
      settlementCol = `<td>${postingLink(a.settled_by[0])} / ${postingLink(a.settled_by[1])}</td>`;
    } else if (showSettlement) {
      settlementCol = `<td>-</td>`;
    }
    html += `<tr>
      <td>${accountLink(id)}</td>
      <td>${esc(a.kind)}</td>
      <td>${stateBadge(a.state)}</td>
      <td style="font-size:0.9rem;">${esc(terms)}</td>
      ${settlementCol}
    </tr>\n`;
  }
  html += `</table>\n`;
  return html;
}

// --------------- build account pages ---------------

function buildAccountPage(accountId, accountInfo, postings, allAccounts) {
  const related = postings.filter((p) => p.accounts.includes(accountId));
  const annotations = related.filter((p) => p.kind === "annotate");
  const otherPostings = related.filter((p) => p.kind !== "annotate");

  let body = `<h1>${esc(accountId)}</h1>\n`;
  body += `<p>${stateBadge(accountInfo.state)} <span style="font-size:0.9rem;color:#6b7280;">kind: ${esc(accountInfo.kind)}</span></p>\n`;

  // Action links into conversational surface (W-2, term 7)
  const actions = [];
  if (accountInfo.state === "OPEN") {
    actions.push(`<a href="converse.html?account=${encodeURIComponent(accountId)}&context=${encodeURIComponent("Fulfill this account")}&input=${encodeURIComponent("")}">fulfill this</a>`);
    actions.push(`<a href="converse.html?account=${encodeURIComponent(accountId)}&context=${encodeURIComponent("Add a note on " + accountId)}">note on this</a>`);
  }
  // Check for pending fulfillments awaiting verification
  const pendingFulfills = postings.filter(
    (p) => p.kind === "fulfill" && p.accounts.includes(accountId) && accountInfo.state === "OPEN"
  );
  for (const f of pendingFulfills) {
    actions.push(`<a href="converse.html?account=${encodeURIComponent(accountId)}&context=${encodeURIComponent("Verify fulfillment " + f.id + " on " + accountId)}&input=${encodeURIComponent("")}">verify ${esc(f.id)}</a>`);
  }
  if (accountInfo.state !== "STANDING") {
    actions.push(`<a href="converse.html?account=${encodeURIComponent(accountId)}&context=${encodeURIComponent("Annotate " + accountId)}">annotate</a>`);
  }
  if (actions.length > 0) {
    body += `<p style="margin:0.5rem 0;font-size:0.9rem;">${actions.join(" &middot; ")}</p>\n`;
  }

  // Current terms
  body += `<h2>Terms</h2>\n<div class="terms">${md(accountInfo.terms)}</div>\n`;

  // Settlement info
  if (accountInfo.settled_by) {
    body += `<h2>Settlement</h2>\n<p>Fulfilled by ${postingLink(accountInfo.settled_by[0])}, verified by ${postingLink(accountInfo.settled_by[1])}</p>\n`;
  }

  // Amendment history
  const amendments = related.filter((p) => p.kind === "amend");
  if (amendments.length > 0) {
    body += `<h2>Amendment history</h2>\n`;
    for (const a of amendments) {
      body += `<div class="posting-card">
        <p class="meta">${postingLink(a.id)} by ${esc(a.author)} at ${esc(a.at)}</p>
        <p>${md(a.content.rationale || "")}</p>
        ${a.content.terms ? `<div class="terms">${md(a.content.terms)}</div>` : ""}
      </div>\n`;
    }
  }

  // Posting timeline (non-annotation)
  body += `<h2>Postings (${otherPostings.length})</h2>\n`;
  for (const p of otherPostings) {
    body += renderPostingCard(p);
  }

  // Annotations as accreting marginalia
  if (annotations.length > 0) {
    body += `<h2>Annotations (${annotations.length})</h2>\n`;
    for (const a of annotations) {
      body += `<div class="annotation">
        <p class="meta">${postingLink(a.id)} by ${esc(a.author)} at ${esc(a.at)}</p>
        <p>${md(a.content.text || "")}</p>
        ${a.vouchers.length ? `<p class="meta">cites: ${a.vouchers.map((v) => esc(v)).join(", ")}</p>` : ""}
      </div>\n`;
    }
  }

  return layout(accountId, body, `<a href="index.html">Index</a> / ${esc(accountId)}`);
}

// --------------- build posting pages ---------------

function renderPostingCard(p) {
  let detail = "";

  if (p.kind === "open") {
    detail = `<div class="terms">${md(p.content.terms || "")}</div>`;
    if (p.content.deferred) {
      detail += `<p style="margin-top:0.5rem;"><em>Deferred:</em> ${md(p.content.deferral_rationale || "")}</p>`;
    }
  } else if (p.kind === "register") {
    const doc = p.content.document || {};
    detail = `<p>Document: <strong>${esc(doc.doc_id || "")}</strong> (${esc(doc.doc_type || "")}) at <code>${esc(doc.location || "")}</code></p>`;
  } else if (p.kind === "fulfill") {
    detail = `<p>${md(p.content.note || "")}</p>`;
  } else if (p.kind === "verify") {
    const verdict = p.content.verdict === "accepted" ? "Accepted" : "Rejected";
    detail = `<p><strong>${verdict}</strong></p>`;
    if (p.content.override_reason) {
      detail += `<p>Override: ${md(p.content.override_reason)}</p>`;
    }
  } else if (p.kind === "annotate") {
    detail = `<p>${md(p.content.text || "")}</p>`;
  } else if (p.kind === "amend") {
    detail = `<p>Rationale: ${md(p.content.rationale || "")}</p>`;
  } else if (p.kind === "reverse") {
    detail = `<p>Rationale: ${md(p.content.rationale || "")}</p>`;
  }

  return `<div class="posting-card">
    <p class="meta">${postingLink(p.id)} <strong>${esc(p.kind)}</strong> by ${esc(p.author)} at ${esc(p.at)}</p>
    ${p.accounts.length ? `<p class="meta">accounts: ${p.accounts.map(accountLink).join(", ")}</p>` : ""}
    ${p.vouchers.length ? `<p class="meta">vouchers: ${p.vouchers.map((v) => esc(v)).join(", ")}</p>` : ""}
    ${p.predecessors.length ? `<p class="meta">predecessors: ${p.predecessors.map(postingLink).join(", ")}</p>` : ""}
    ${detail}
  </div>\n`;
}

function buildPostingPage(p) {
  let body = `<h1>Posting: ${esc(p.id)}</h1>\n`;
  body += `<table>
    <tr><td style="font-weight:600;width:120px;">Kind</td><td>${esc(p.kind)}</td></tr>
    <tr><td style="font-weight:600;">Author</td><td>${esc(p.author)}</td></tr>
    <tr><td style="font-weight:600;">Time</td><td>${esc(p.at)}</td></tr>
    <tr><td style="font-weight:600;">Grammar</td><td>${esc(p.grammar)}</td></tr>
    <tr><td style="font-weight:600;">Accounts</td><td>${p.accounts.map(accountLink).join(", ") || "-"}</td></tr>
    <tr><td style="font-weight:600;">Vouchers</td><td>${p.vouchers.length ? p.vouchers.map((v) => esc(v)).join(", ") : "-"}</td></tr>
    <tr><td style="font-weight:600;">Predecessors</td><td>${p.predecessors.length ? p.predecessors.map(postingLink).join(", ") : "-"}</td></tr>
  </table>\n`;

  body += `<h2>Content</h2>\n<pre style="background:#f9fafb;padding:1rem;border-radius:6px;overflow-x:auto;font-size:0.9rem;">${esc(JSON.stringify(p.content, null, 2))}</pre>\n`;

  // Raw canonical form
  const canonical = {};
  for (const key of ["id", "kind", "author", "at", "accounts", "vouchers", "predecessors", "content", "grammar"]) {
    canonical[key] = p[key];
  }
  body += `<h2>Canonical form</h2>\n<pre style="background:#f3f4f6;padding:0.75rem;border-radius:6px;overflow-x:auto;font-size:0.8rem;color:#374151;">${esc(JSON.stringify(canonical))}</pre>\n`;

  return layout(`Posting ${p.id}`, body, `<a href="index.html">Index</a> / ${p.accounts.length ? accountLink(p.accounts[0]) + " / " : ""}${esc(p.id)}`);
}

// --------------- main ---------------

const postings = loadJournal();
const accounts = derive(postings);

// Generate index
fs.writeFileSync(path.join(PUBLIC, "index.html"), buildIndex(postings, accounts));

// Generate account pages
for (const [id, info] of Object.entries(accounts)) {
  fs.writeFileSync(
    path.join(PUBLIC, `account-${id}.html`),
    buildAccountPage(id, info, postings, accounts)
  );
}

// Generate posting pages
for (const p of postings) {
  fs.writeFileSync(
    path.join(PUBLIC, `posting-${p.id}.html`),
    buildPostingPage(p)
  );
}

console.log(`Generated ${Object.keys(accounts).length} account pages, ${postings.length} posting pages, 1 index`);
console.log(`Site: ${PUBLIC}`);
