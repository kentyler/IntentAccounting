/**
 * K-5: MCP tool definitions
 *
 * Thin wrappers over the same logic as REST endpoints.
 * MCP transport for LLM actors to interact with the instance.
 */

const journal = require("./journal");
const { derive } = require("./derive");
const { render } = require("./render");

/**
 * MCP tool definitions. Each tool has a name, description, inputSchema,
 * and a handler function.
 */
const tools = [
  {
    name: "post",
    description: "Submit a posting to the journal. Rejects only on canonical well-formedness (P-4).",
    inputSchema: {
      type: "object",
      properties: {
        posting: {
          type: "object",
          description: "A canonical posting object with all required fields: id, kind, author, at, accounts, vouchers, predecessors, content, grammar",
        },
      },
      required: ["posting"],
    },
    handler(args) {
      try {
        const result = journal.append(args.posting);
        return { ok: true, posting: result };
      } catch (err) {
        if (err.validationErrors) {
          return { ok: false, errors: err.validationErrors };
        }
        return { ok: false, errors: [err.message] };
      }
    },
  },
  {
    name: "read_journal",
    description: "Export the full journal as canonical/1 text.",
    inputSchema: { type: "object", properties: {} },
    handler() {
      return { text: journal.exportCanonical() };
    },
  },
  {
    name: "read_state",
    description: "Read derived state: account balances (STANDING, OPEN, SETTLED) and current terms.",
    inputSchema: { type: "object", properties: {} },
    handler() {
      const postings = journal.read();
      return derive(postings);
    },
  },
  {
    name: "read_audit",
    description: "Read the deterministic audit rendering of derived state.",
    inputSchema: { type: "object", properties: {} },
    handler() {
      const postings = journal.read();
      const accounts = derive(postings);
      return { text: render(accounts) };
    },
  },
];

/**
 * Mount MCP endpoints on an Express app.
 * Implements the MCP JSON-RPC protocol subset for tools.
 */
function mountMCP(app) {
  const toolMap = {};
  for (const t of tools) {
    toolMap[t.name] = t;
  }

  app.post("/mcp", (req, res) => {
    const { method, params, id } = req.body || {};

    if (method === "tools/list") {
      const listed = tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
      return res.json({ jsonrpc: "2.0", id, result: { tools: listed } });
    }

    if (method === "tools/call") {
      const toolName = params && params.name;
      const tool = toolMap[toolName];
      if (!tool) {
        return res.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `unknown tool: ${toolName}` },
        });
      }
      const result = tool.handler(params.arguments || {});
      return res.json({
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: JSON.stringify(result) }] },
      });
    }

    res.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `unknown method: ${method}` },
    });
  });
}

module.exports = { tools, mountMCP };
