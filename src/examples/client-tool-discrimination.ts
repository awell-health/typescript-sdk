import { Client } from "../client/index.js";
import { StdioClientTransport } from "../client/stdio.js";

async function main() {
  const client = new Client({ name: "Role Demo Client", version: "1.0.0" });
  const transport = new StdioClientTransport();
  await client.connect(transport);

  // Set your role here
  const role = process.argv[2] || "user"; // Pass "admin" or "user" as a command-line argument

  // List tools available for this role
  const toolsList = await client.request(
    {
      method: "tools/list",
      params: {
        _meta: { discriminator: role },
      },
    }
  );
  console.log("Visible tools:", toolsList.tools.map((t: any) => t.name));

  // Call the tool with the same name as the role
  const toolName = role;
  const result = await client.request({
    method: "tools/call",
    params: {
      name: toolName,
      arguments: {},
      _meta: { discriminator: role },
    },
  });
  console.log("Tool call result:", result);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
