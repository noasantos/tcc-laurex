import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Store } from "./store";
import { Domain } from "./domain";
import { createMcp } from "./mcp";
const store = new Store();
const server = createMcp(new Domain(store));
await server.connect(new StdioServerTransport());
process.on("SIGTERM", () => {
  store.close();
  process.exit(0);
});
