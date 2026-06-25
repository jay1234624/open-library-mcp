# Open Library MCP Server

## Overview

This project is a Model Context Protocol (MCP) server built with TypeScript. It connects AI assistants to the Open Library API for searching books and authors, retrieving metadata, comparing works, and finding text snippets inside books.

## Technologies Used

- TypeScript
- Node.js
- Model Context Protocol (MCP)
- Open Library API

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

## Run

```bash
npm start
```

The server uses **stdio** transport. Point your MCP client at `dist/index.js`.

## Available MCP Tools

### Search

| Tool | Parameters | Description |
|------|------------|-------------|
| `search_books` | `query` | Search books by title, author, or keyword |
| `search_authors` | `query`, optional `limit` (default 10, max 25) | Search authors by name |
| `read_book_snippet` | `query`, optional `limit` (default 3, max 10) | Search inside books for text snippets |

### Books & works

| Tool | Parameters | Description |
|------|------------|-------------|
| `get_work_details` | `workId` | Full work record by Open Library work ID |
| `get_book_details_by_isbn` | `isbn` | Book details by ISBN-10 or ISBN-13 |
| `get_editions` | `workId` | List editions for a work |
| `get_book_ratings` | `workId` | Aggregate reader ratings for a work |
| `get_book_summary` | `workId` | Concise metadata summary (title, description, subjects, etc.) |
| `compare_books` | `workId1`, `workId2` | Side-by-side comparison of two works |

### Authors

| Tool | Parameters | Description |
|------|------------|-------------|
| `get_author_profile` | `authorId` | Author biography and profile by ID |
| `get_author_works` | `authorId`, optional `limit` (default 20, max 100), optional `offset` | Author bibliography |

### Subjects

| Tool | Parameters | Description |
|------|------------|-------------|
| `get_subject_insights` | `subject`, optional `limit` (default 20, max 100), optional `offset` | Books and trends for a subject/topic |
