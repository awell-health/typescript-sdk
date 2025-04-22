import express from "express";
import cors from "cors";
import { McpServer } from "../server/mcp.js";
import { StreamableHTTPServerTransport } from "../server/streamableHttp.js";
import { z } from "zod";

const app = express();
app.use(cors());
app.use(express.json());

const mcpServer = new McpServer({ name: "Hogwarts Library Gatekeeper", version: "1.0.0" });

// --- Define Roles and Tools ---
// Roles: student, prefect, teacher
// Tools: Standard Book, Restricted Section, Cursed Scroll
mcpServer.tool("standard_book", "Standard Book (All students)", async () => ({
  content: [{ type: "text", text: "Here is your Standard Book. Happy studying!" }],
}));
mcpServer.tool("restricted_section", "Restricted Section (Prefects/Teachers)", async () => ({
  content: [{ type: "text", text: "You may enter the Restricted Section. Use caution!" }],
}));
mcpServer.tool("cursed_scroll", "Cursed Scroll (Teachers Only)", async () => ({
  content: [{ type: "text", text: "Beware! The Cursed Scroll is not for the faint of heart." }],
}));

// --- Tool Discriminator (Policy Head) ---
mcpServer.setToolDiscriminator((request) => async ({ name }) => {
  const role = request.params?._meta?.discriminator;
  if (!role) return false;
  if (name === "standard_book") return ["student", "prefect", "teacher"].includes(role);
  if (name === "restricted_section") return ["prefect", "teacher"].includes(role);
  if (name === "cursed_scroll") return role === "teacher";
  return false;
});

// --- MCP Handler with Logging ---
app.post("/mcp", async (req, res) => {
  console.log(`[MCP] ${new Date().toISOString()} | Role: ${req.body?.params?._meta?.discriminator} | Method: ${req.body?.method}`);
  try {
    // Use stateless mode: disable session management and enable JSON response
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
    console.log("[MCP] Successfully handled request.");
  } catch (err) {
    console.error("[MCP] Error handling request:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal MCP server error", details: err?.toString() });
    }
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`MCP server running at http://localhost:${PORT}`);
});
