import { McpServer } from "../server/mcp.js";
import { StdioServerTransport } from "../server/stdio.js";
import { z } from "zod";

async function main() {
  const server = new McpServer({ name: "Role Demo Server", version: "1.0.0" });

  // Register tools
  server.tool("admin", "Admin-only tool", async () => ({
    content: [{ type: "text", text: "Admin tool response" }],
  }));

  server.tool("user", "User tool", async () => ({
    content: [{ type: "text", text: "User tool response" }],
  }));

  // Set up tool discriminator based on what the client sends in _meta.discriminator
  server.setToolDiscriminator((request) => async ({ name }) => {
    const discriminator = request.params?._meta?.discriminator;
    if (!discriminator) return false; // Require discriminator
    // Only show/call tool if its name matches the discriminator
    return name === discriminator;
  });

  // Start the server using stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
