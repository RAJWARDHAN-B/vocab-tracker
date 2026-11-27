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

## Assistant import API

Send `POST /api/words` with `Authorization: Bearer <ASSISTANT_API_KEY>` and a
JSON body containing a `words` array. The batch limit is 50 entries; the
request body limit is 256 KiB. Required strings are limited to 200 characters
for `word` and 2,000 for `meaning`, `example`, and `in_a_sentence`; list items
are limited to 100 characters (50 items per list). Captions are limited to
500 characters and image URLs to 2,048 characters. Image links must be
absolute HTTPS URLs without embedded credentials. Imports are independently
validated and report `created`, `duplicate`, or `invalid` per entry. The API
allows 60 requests per hour per key, enforced in the database.

The `example` and `in_a_sentence` fields are separate and must both be sent.
The import endpoint never fabricates or replaces either field. The owner
password is for browser sign-in only; it is not the import API key.

## Checks

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for the application design,
behavior, and deployment checklist.
