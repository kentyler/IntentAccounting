/**
 * Intent Accounting instance server.
 *
 * Express app mounting REST routes and MCP endpoint.
 */

const express = require("express");
const routes = require("./routes");
const { mountMCP } = require("./mcp");

const app = express();
app.use(express.json());

// REST endpoints
app.use(routes);

// MCP endpoint
mountMCP(app);

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Intent Accounting instance running on port ${PORT}`);
  });
}

module.exports = app;
