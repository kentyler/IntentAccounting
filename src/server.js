/**
 * Intent Accounting instance server.
 *
 * Express app mounting REST routes and MCP endpoint.
 */

const express = require("express");
const path = require("path");
const routes = require("./routes");
const { mountMCP } = require("./mcp");
const { mountDraft } = require("./draft");

const app = express();
app.use(express.json());

// Browse surface (W-1): static HTML, read-only
app.use(express.static(path.join(__dirname, "..", "public")));

// REST endpoints
app.use(routes);

// MCP endpoint
mountMCP(app);

// Conversational drafting (W-2)
mountDraft(app);

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Intent Accounting instance running on port ${PORT}`);
  });
}

module.exports = app;
