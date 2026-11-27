# Fern

A private vocabulary garden for collecting words and revising them every day.

## Run locally

1. Install Node.js 20.9 or newer, then run `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Set a unique `OWNER_USERNAME`, `OWNER_PASSWORD`, and an `AUTH_SECRET` with at
   least 32 random characters. Keep `ASSISTANT_API_KEY` separate from the owner
   password. Generate secrets with `openssl rand -base64 32`.
4. Run `npm run db:generate` if the schema has changed, then `npm run db:migrate`.
5. Run `npm run dev` and open <http://localhost:3000>.

The default database is a local SQLite-compatible libSQL file at
`data/vocab.db`. To use Turso, set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
to server-side credentials before running the migration. Do not commit
`.env.local`.

## Assistant agent API

All assistant endpoints require `Authorization: Bearer <ASSISTANT_API_KEY>`:

- `GET /api/agent` — Returns the API specification, JSON Schemas (Draft 2020-12),
  limits, and editorial instructions for the agent. Returns JSON by default; pass
  `?format=markdown` (or `Accept: text/markdown`) for a Markdown guide.
- `GET /api/agent/words` — Lists saved words in reverse chronological order with
  optional `?q=<search>`, `?tag=<tag>`, `?limit=<1-100>` (default `50`), and
  `?offset=<>=0>`.
- `GET /api/agent/words/:id_or_word` — Looks up a single word by UUID or
  normalized spelling (`trim`, Unicode NFKC, lowercase).
- `POST /api/agent/words` (alias: `POST /api/words`) — Batch-uploads 1 to 50
  vocabulary entries in a `{ "words": [...] }` JSON body.

Each word also supports an optional `tag` field constrained to: `noun`, `verb`,
`adjective`, `adverb`, `pronoun`, `preposition`, `conjunction`, `interjection`,
`idiom`, or `phrase` (or `null` / omitted).

The batch limit is 50 entries; the request body limit is 256 KiB. Required
strings are limited to 200 characters for `word` and 2,000 for `meaning`,
`example`, and `in_a_sentence`; list items are limited to 100 characters (50
items per list). Captions are limited to 500 characters and image URLs to 2,048
characters. Image links must be absolute HTTPS URLs without embedded
credentials. Imports are independently validated and report `created`,
`duplicate`, or `invalid` per entry. Rate limits are enforced in the database:
60 import requests per hour and 180 read requests per hour per key.

The `example` and `in_a_sentence` fields are separate and must both be sent.
The import endpoint never fabricates or replaces either field. The owner
password is for browser sign-in only; it is not the import API key.

## Checks

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for the application design,
behavior, and deployment checklist.
