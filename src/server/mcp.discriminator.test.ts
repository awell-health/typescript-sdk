import { McpServer } from "./mcp.js";
import { Client } from "../client/index.js";
import { InMemoryTransport } from "../inMemory.js";
import { ListToolsResultSchema, CallToolResultSchema } from "../types.js";
import { z } from "zod";

describe("tool discrimination", () => {
  let mcpServer: McpServer;
  let client: Client;

  beforeEach(async () => {
    mcpServer = new McpServer({
      name: "test server",
      version: "1.0",
    });

    // Register tools with different discriminators
    mcpServer.tool("admin", "Admin only tool", async () => ({
      content: [{ type: "text", text: "Admin tool response" }],
    }));

    mcpServer.tool("user", "User tool", async () => ({
      content: [{ type: "text", text: "User tool response" }],
    }));

    // Set up the discriminator
    mcpServer.setToolDiscriminator((request) => async ({ name, tool: _tool }) => {
      const discriminator = request.params?._meta?.discriminator;
      console.log("discriminator", discriminator, "name", name);
      if (!discriminator) {
        return true
      }
      return name === discriminator;
    });

    client = new Client({
      name: "test client",
      version: "1.0",
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      mcpServer.server.connect(serverTransport),
    ]);
  });

  test("should show all tools when no discriminator is provided", async () => {
    const result = await client.request(
      { method: "tools/list" },
      ListToolsResultSchema,
    );

    expect(result.tools).toHaveLength(2);
    expect(result.tools.map(t => t.name)).toEqual(["admin", "user"]);
  });

  test("should show all tools when admin discriminator is provided", async () => {
    const result = await client.request(
      {
        method: "tools/list",
        params: {
          _meta: {
            discriminator: "admin",
          },
        },
      },
      ListToolsResultSchema,
    );

    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe("admin");
  });

  test("should show only user tools when user discriminator is provided", async () => {
    const result = await client.request(
      {
        method: "tools/list",
        params: {
          _meta: {
            discriminator: "user",
          },
        },
      },
      ListToolsResultSchema,
    );

    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe("user");
  });

  describe("tool call discrimination", () => {
    let mcpServer: McpServer;
    let client: Client;

    beforeEach(async () => {
      mcpServer = new McpServer({
        name: "test server",
        version: "1.0",
      });

      // Register a tool that requires admin access
      mcpServer.tool(
        "admin-only",
        "Admin only tool with args",
        {
          action: z.string(),
        },
        async ({ action }) => ({
          content: [{ type: "text", text: `Admin performed: ${action}` }],
        }),
      );

      // Set up the discriminator
      mcpServer.setToolDiscriminator((request) => async ({ name, tool: _tool }) => {
        // Require discriminator for all tool calls
        if (!request.params?._meta?.discriminator) {
          return false;
        }
        const discriminator = request.params._meta.discriminator;
        
        // Only allow admin-only tool with admin discriminator
        return discriminator === "admin" && name === "admin-only";
      });

      client = new Client({
        name: "test client",
        version: "1.0",
      });

      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

      await Promise.all([
        client.connect(clientTransport),
        mcpServer.server.connect(serverTransport),
      ]);
    });

    test("should reject tool call without discriminator", async () => {
      await expect(
        client.request(
          {
            method: "tools/call",
            params: {
              name: "admin-only",
              arguments: {
                action: "test",
              },
            },
          },
          CallToolResultSchema,
        ),
      ).rejects.toThrow(/not found/);
    });

    test("should reject tool call with user discriminator", async () => {
      await expect(
        client.request(
          {
            method: "tools/call",
            params: {
              name: "admin-only",
              arguments: {
                action: "test",
              },
              _meta: {
                discriminator: "user",
              },
            },
          },
          CallToolResultSchema,
        ),
      ).rejects.toThrow(/not found/);
    });

    test("should allow tool call with admin discriminator", async () => {
      const result = await client.request(
        {
          method: "tools/call",
          params: {
            name: "admin-only",
            arguments: {
              action: "test",
            },
            _meta: {
              discriminator: "admin",
            },
          },
        },
        CallToolResultSchema,
      );

      expect(result.content[0].text).toBe("Admin performed: test");
    });
  });
}); 