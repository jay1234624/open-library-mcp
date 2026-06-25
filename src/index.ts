import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const OPEN_LIBRARY_BASE = "https://openlibrary.org";

const server = new McpServer({
  name: "open-library-mcp",
  version: "1.0.0",
});

// Strip paths like "/works/OL123W" down to just "OL123W"
function normalizeId(id: string): string {
  return id.replace(/^\//, "").split("/").pop() ?? id;
}

async function fetchOpenLibrary(path: string): Promise<unknown> {
  const url = `${OPEN_LIBRARY_BASE}${path}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Open Library request failed (${response.status}): ${url}`);
  }

  return response.json();
}

function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

server.registerTool(
  "search_books",
  {
    description: "Search Open Library for books by title, author, or keyword",
    inputSchema: z.object({
      query: z.string().describe("Search query, e.g. 'Pride and Prejudice'"),
    }),
  },
  async ({ query }) => {
    const data = await fetchOpenLibrary(
      `/search.json?q=${encodeURIComponent(query)}&limit=10`
    );
    return jsonResult(data);
  }
);

server.registerTool(
  "get_work_details",
  {
    description: "Get details for a book work by its Open Library work ID",
    inputSchema: z.object({
      workId: z
        .string()
        .describe("Work ID, e.g. 'OL27448W' or '/works/OL27448W'"),
    }),
  },
  async ({ workId }) => {
    const id = normalizeId(workId);
    const data = await fetchOpenLibrary(`/works/${id}.json`);
    return jsonResult(data);
  }
);

server.registerTool(
  "get_author_profile",
  {
    description: "Get an author profile by Open Library author ID",
    inputSchema: z.object({
      authorId: z
        .string()
        .describe("Author ID, e.g. 'OL26320A' or '/authors/OL26320A'"),
    }),
  },
  async ({ authorId }) => {
    const id = normalizeId(authorId);
    const data = await fetchOpenLibrary(`/authors/${id}.json`);
    return jsonResult(data);
  }
);

server.registerTool(
  "get_editions",
  {
    description: "Get editions of a book work by its Open Library work ID",
    inputSchema: z.object({
      workId: z
        .string()
        .describe("Work ID, e.g. 'OL27448W' or '/works/OL27448W'"),
    }),
  },
  async ({ workId }) => {
    const id = normalizeId(workId);
    const data = await fetchOpenLibrary(`/works/${id}/editions.json?limit=20`);
    return jsonResult(data);
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Open Library MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
