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

// Turn "Science Fiction" into "science_fiction" for the Subjects API
function normalizeSubject(subject: string): string {
  return subject.trim().toLowerCase().replace(/\s+/g, "_");
}

// Shared pagination limits used by list-style tools
const paginationSchema = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Number of results to return (default 20, max 100)"),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Starting offset for pagination (default 0)"),
};

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

// Open Library sometimes stores descriptions as plain text or { value: "..." }
function extractDescription(description: unknown): string | undefined {
  if (typeof description === "string") {
    return description;
  }

  if (
    description &&
    typeof description === "object" &&
    "value" in description
  ) {
    return String((description as { value: unknown }).value);
  }

  return undefined;
}

// Pull the key metadata fields shared by summary and comparison tools
function extractWorkFields(data: Record<string, unknown>) {
  const subjects = data.subjects as string[] | undefined;

  return {
    title: data.title,
    description: extractDescription(data.description),
    subjects,
    first_publish_date: data.first_publish_date,
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

server.registerTool(
  "get_author_works",
  {
    description:
      "Get the bibliography (list of works) for an author by Open Library author ID",
    inputSchema: z.object({
      authorId: z
        .string()
        .describe("Author ID, e.g. 'OL26320A' or '/authors/OL26320A'"),
      ...paginationSchema,
    }),
  },
  async ({ authorId, limit = 20, offset = 0 }) => {
    const id = normalizeId(authorId);
    const data = await fetchOpenLibrary(
      `/authors/${id}/works.json?limit=${limit}&offset=${offset}`
    );
    return jsonResult(data);
  }
);

server.registerTool(
  "get_subject_insights",
  {
    description:
      "Get books and trends for a subject/topic on Open Library (e.g. science_fiction)",
    inputSchema: z.object({
      subject: z
        .string()
        .describe("Subject name, e.g. 'science fiction' or 'science_fiction'"),
      ...paginationSchema,
    }),
  },
  async ({ subject, limit = 20, offset = 0 }) => {
    const slug = normalizeSubject(subject);
    const data = await fetchOpenLibrary(
      `/subjects/${encodeURIComponent(slug)}.json?limit=${limit}&offset=${offset}`
    );
    return jsonResult(data);
  }
);

server.registerTool(
  "get_book_ratings",
  {
    description:
      "Get aggregate reader ratings for a book work (average score and star counts)",
    inputSchema: z.object({
      workId: z
        .string()
        .describe("Work ID, e.g. 'OL27448W' or '/works/OL27448W'"),
    }),
  },
  async ({ workId }) => {
    const id = normalizeId(workId);
    // Ratings are stored on works, not individual editions
    const data = await fetchOpenLibrary(`/works/${id}/ratings.json`);
    return jsonResult(data);
  }
);

server.registerTool(
  "search_authors",
  {
    description: "Search for authors by name on Open Library",
    inputSchema: z.object({
      query: z.string().describe("Author name to search, e.g. 'Tolkien'"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(25)
        .optional()
        .describe("Number of results to return (default 10, max 25)"),
    }),
  },
  async ({ query, limit = 10 }) => {
    const data = await fetchOpenLibrary(
      `/search/authors.json?q=${encodeURIComponent(query)}&limit=${limit}`
    );
    return jsonResult(data);
  }
);

server.registerTool(
  "get_book_details_by_isbn",
  {
    description: "Retrieve detailed information for a book using its ISBN",
    inputSchema: z.object({
      isbn: z
        .string()
        .describe("ISBN-10 or ISBN-13, e.g. '9780547928227'"),
    }),
  },
  async ({ isbn }) => {
    const normalizedIsbn = isbn.trim().replace(/[-\s]/g, "");
    const data = await fetchOpenLibrary(`/isbn/${normalizedIsbn}.json`);
    return jsonResult(data);
  }
);

server.registerTool(
  "read_book_snippet",
  {
    description:
      "Search inside books and return text snippets when available",
    inputSchema: z.object({
      query: z
        .string()
        .describe("Text to search for inside books, e.g. 'ring of power'"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe("Number of snippets to return (default 3, max 10)"),
    }),
  },
  async ({ query, limit = 3 }) => {
    const noSnippetsMessage =
      "No text snippets were found for that query. Try different keywords or a more specific phrase.";

    try {
      const data = await fetchOpenLibrary(
        `/search/inside.json?q=${encodeURIComponent(query)}&limit=${limit}`
      );
      const hits =
        (data as { hits?: { hits?: Array<Record<string, unknown>> } }).hits
          ?.hits ?? [];

      if (hits.length === 0) {
        return jsonResult({
          message: noSnippetsMessage,
          query,
          snippets: [],
        });
      }

      const snippets = hits.map((hit) => ({
        text: (hit.highlight as { text?: string[] } | undefined)?.text ?? [],
        score: hit._score,
      }));

      return jsonResult({
        query,
        count: snippets.length,
        snippets,
      });
    } catch {
      return jsonResult({
        message: noSnippetsMessage,
        query,
        snippets: [],
      });
    }
  }
);

server.registerTool(
  "compare_books",
  {
    description:
      "Compare two books side by side using their Open Library work IDs",
    inputSchema: z.object({
      workId1: z
        .string()
        .describe("First work ID, e.g. 'OL27448W' or '/works/OL27448W'"),
      workId2: z
        .string()
        .describe("Second work ID, e.g. 'OL52267W' or '/works/OL52267W'"),
    }),
  },
  async ({ workId1, workId2 }) => {
    const id1 = normalizeId(workId1);
    const id2 = normalizeId(workId2);

    const [book1, book2] = await Promise.all([
      fetchOpenLibrary(`/works/${id1}.json`),
      fetchOpenLibrary(`/works/${id2}.json`),
    ]);

    return jsonResult({
      book1: extractWorkFields(book1 as Record<string, unknown>),
      book2: extractWorkFields(book2 as Record<string, unknown>),
    });
  }
);

server.registerTool(
  "get_book_summary",
  {
    description:
      "Get a concise summary of a book's metadata from its Open Library work ID",
    inputSchema: z.object({
      workId: z
        .string()
        .describe("Work ID, e.g. 'OL27448W' or '/works/OL27448W'"),
    }),
  },
  async ({ workId }) => {
    const id = normalizeId(workId);
    const data = await fetchOpenLibrary(`/works/${id}.json`);
    const work = data as Record<string, unknown>;
    const subjects = work.subjects as string[] | undefined;

    return jsonResult({
      ...extractWorkFields(work),
      number_of_subjects: subjects?.length ?? 0,
    });
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
