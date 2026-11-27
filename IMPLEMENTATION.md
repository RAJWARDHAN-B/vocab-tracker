# Fern implementation

## Status and goal

This document records the implementation and operating assumptions for Fern,
a personal vocabulary app. The owner can add and edit words in the app, and an
existing AI assistant can add words through an authenticated API.

The vocabulary entry has **two separate fields**, `example` and
`in_a_sentence`. They must be collected, stored, displayed, and imported
independently. Their precise editorial distinction can follow the owner's
preferred vocabulary format; the application must not merge or automatically
generate either field.

## Agreed stack

- **Application:** Next.js with TypeScript.
- **Database:** Turso, using its SQLite-compatible database.
- **Hosting:** Vercel.
- **Images:** external links stored in the database, not image uploads.
- **Content generation:** the owner's existing AI assistant; the app does not
  need a paid AI API.

The app and database should fit within the providers' free tiers for personal
use, but this is not guaranteed. Check current usage and limits before
deployment and periodically afterward. Export backups separately.

## MVP scope

1. Owner-only sign-in and a protected app.
2. A form to create and edit vocabulary entries.
3. An authenticated API for the assistant to submit entries in batches.
4. A vocabulary list and revision cards showing all entry fields.
5. Daily review with `again` and `got_it` outcomes.
6. Daily progress and a streak derived from recorded reviews.

Multiple users, image uploads, automatic AI generation, public sharing, and
advanced gamification are outside the initial scope.

## Architecture

```text
Owner's browser -- sign-in/session --> Next.js app -- database client --> Turso
AI assistant ---- API bearer key ----> Next.js API -- database client --> Turso
Browser --------- HTTPS image URL ------------------------------------> image host
```

Use the same server-side validation and word-creation logic for the form and
the API. Database credentials, session secrets, and the assistant API key must
remain server-side. The API key grants import access; it is not the owner's
browser login credential.

### Sign-in and authorization

- Use Auth.js Credentials with one owner username and password configured only
  in server environment variables. Set `AUTH_SECRET` to a random secret of at
  least 32 characters. Auth.js issues the protected session and provides
  CSRF protection for the credentials flow.
- Do not use the assistant import API key as the browser login password.
- Protect every app page and every server action or route that reads or
  changes private data. Do not rely only on hiding navigation links.
- Validate the session and owner authorization on the server for every
  protected operation. Apply the authentication library's recommended
  protections against cross-site request forgery.
- Configure the owner credentials and `AUTH_SECRET` in Vercel. Never expose
  them to client-side code.

## Data model

The following is a logical schema for a single owner. Use SQLite-compatible
types and migrations; a TypeScript database toolkit such as Drizzle is a
reasonable option, but is not yet a requirement.

### `words`

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | `TEXT` | Primary key, generated UUID. |
| `word` | `TEXT` | Required display spelling. |
| `normalized_word` | `TEXT` | Required unique duplicate-detection key. |
| `meaning` | `TEXT` | Required meaning. |
| `synonyms` | `TEXT` | JSON array of strings; may be empty. |
| `antonyms` | `TEXT` | JSON array of strings; may be empty. |
| `example` | `TEXT` | Required example, separate from `in_a_sentence`. |
| `in_a_sentence` | `TEXT` | Required sentence, separate from `example`. |
| `image_url` | `TEXT`, nullable | Optional direct HTTPS image URL. |
| `image_caption` | `TEXT`, nullable | Optional caption or attribution. |
| `next_review_at` | `TEXT` | UTC ISO 8601 timestamp when the word is next due. |
| `review_interval_days` | `INTEGER` | Current review interval; initially `0`. |
| `created_at` | `TEXT` | UTC ISO 8601 creation timestamp. |
| `updated_at` | `TEXT` | UTC ISO 8601 last-update timestamp. |

- Trim required text and reject empty values. Keep both sentence fields even if
  their contents happen to match; do not silently substitute one for the other.
- Store synonym and antonym lists as JSON text and validate that each entry is
  a non-empty string. Treat omitted lists as empty arrays.
- Store absent image values as `NULL`. An image may have no caption; do not
  invent a caption or URL.
- Generate `normalized_word` consistently in all create and edit paths: trim,
  normalize Unicode to NFKC, and convert to lowercase. Keep `word` for display.
  Enforce uniqueness with a database unique constraint so concurrent imports
  cannot create duplicates. The initial model therefore permits one entry per
  normalized spelling; supporting separate senses can be added later.
- New words are immediately due: initialize `next_review_at` to their creation
  time. Editing a word does not reset its review schedule.
- Index `next_review_at` for finding due words.

### `reviews`

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | `TEXT` | Primary key, generated UUID. |
| `word_id` | `TEXT` | Required foreign key referencing `words.id`. |
| `outcome` | `TEXT` | Required value: `again` or `got_it`. |
| `reviewed_at` | `TEXT` | UTC ISO 8601 review timestamp. |

Use a database constraint for the allowed outcomes, enable foreign-key
enforcement for database connections, and index `word_id` and `reviewed_at`.
Record the review and update the word's scheduling fields in a single
transaction. The word must exist and be accessible to the owner.

Review events are the source of truth for daily review counts and streaks.
The scheduling columns on `words` are the current state used to efficiently
find due words.

## Revision experience

### Proposed initial behavior

The initial review behavior is:

1. Select words whose `next_review_at` is at or before the current time.
2. Show due words in a random order, initially up to 10 per session. Clearly
   show when no words are due.
3. Reveal the meaning and remaining details on the card, then let the owner
   select `again` or `got_it`.
4. On `again`, set the interval to one day. On `got_it`, move to the next
   interval in `3, 7, 14, 30` days, using 3 days when the current interval is
   less than 3 and capping at 30.
5. Set `next_review_at` to the review timestamp plus the selected number of
   days, and record the outcome.

The daily review count is the number of review events on a given local
calendar day. A streak counts consecutive days with at least one review.
Use the configured IANA time zone `Asia/Kolkata` for day boundaries and
convert stored UTC timestamps when calculating progress; do not use the
server's implicit local time zone. The dashboard also has one five-minute
study timer per day, resetting at local midnight. Timer completion is stored
server-side and is separate from the review-event count and streak.

## Owner interface

- **Sign-in:** authenticate and reject accounts other than the owner.
- **Word list:** search or browse saved words and open a word for editing.
- **Add/edit form:** include every field in `words` that the owner supplies,
  including distinct inputs for `example` and `in_a_sentence`.
- **Review screen:** show due cards, the two distinct fields, image and caption,
  review buttons, and the number reviewed today.
- **Progress:** show the daily count and streak; avoid claiming a review was
  saved until the server confirms it.
- **Errors:** show validation, duplicate, authentication, and save errors
  clearly. Preserve entered form data when submission fails.

For image URLs, require an absolute HTTPS URL and reject malformed URLs or
embedded credentials. Display the image through a normal browser request with
a visible fallback if it fails. Do not fetch arbitrary image URLs on the server
or use an unrestricted server-side image proxy. External hosts can remove
images or restrict embedding, and loading an image contacts that host. Keep
attribution when required and use images under suitable licenses.

## Assistant import API

### Authentication

- Proposed endpoint: `POST /api/words`.
- The assistant sends `Authorization: Bearer <API_KEY>` over HTTPS.
- Generate a long random key, store it as a server-only Vercel environment
  variable, and provide it to the assistant through its secure secret storage.
  Do not put the key in source control, frontend bundles, examples, or a
  checked-in instruction file.
- Validate the key on the server using a timing-safe comparison. Reject a
  missing or invalid key with `401` before processing the request.
- Support key rotation by updating the server secret and assistant secret.
  Never log the key, authorization header, or full secret-bearing request.
- Apply an appropriate request-size limit and a persistent rate limit before
  exposing the endpoint publicly; an in-memory counter is not reliable across
  serverless instances.

### Request shape

The API accepts a JSON object with a `words` array. The following example is a
proposed contract; no real API endpoint exists yet:

```json
{
  "words": [
    {
      "word": "ephemeral",
      "meaning": "Lasting for a very short time.",
      "synonyms": ["fleeting", "brief"],
      "antonyms": ["lasting", "enduring"],
      "example": "An ephemeral trend.",
      "in_a_sentence": "The rainbow was ephemeral, fading within minutes.",
      "image_url": null,
      "image_caption": null
    }
  ]
}
```

`word`, `meaning`, `example`, and `in_a_sentence` are required non-empty
strings. `synonyms` and `antonyms` are arrays of strings and may be omitted
or empty. Image fields are optional strings or `null`. The assistant must
provide a real direct image link only when it has one; it should use `null`
instead of guessing.

Validate the top-level object and every entry. Limits are 50 entries per
batch, 256 KiB per request, 200 characters for `word`, 2,000 for `meaning`,
`example`, and `in_a_sentence`, 50 items of 100 characters each per
synonym/antonym list, 2,048 characters for an image URL, and 500 characters
for an image caption. The persistent libSQL rate limit is 60 requests per
hour per API key.

### Results and duplicates

For a well-formed batch, process entries independently and return a result for
each input index. A successful response may therefore contain a mixture of
created, duplicate, and invalid entries. A duplicate must not silently overwrite
an existing word.

```json
{
  "results": [
    { "index": 0, "status": "created", "id": "generated-word-id" }
  ]
}
```

- `created`: the entry was saved; include its ID.
- `duplicate`: the normalized spelling already exists; report the conflict.
- `invalid`: include field-level error messages without exposing secrets.
- Return `400` for malformed JSON or an invalid top-level request, `401` for
  invalid authentication, and a clear server error if processing cannot be
  completed. Do not return a success response for a database failure.

The unique spelling constraint protects against duplicate retries. Retrying a
previously created word returns `duplicate`, rather than creating a second
entry. The UI can offer editing; API updates are outside the first import
contract.

## Configuration and deployment

1. Create a Turso database and configure server-only connection credentials.
2. Apply the versioned Drizzle database migrations.
3. Configure the owner username, password, and Auth.js secret in Vercel.
4. Generate the assistant API key and configure it on Vercel and in the
   assistant's secret storage.
5. Configure the app's review time zone and deploy to Vercel.
6. Apply migrations to the intended database and test login, manual entry,
   import, and review against the deployed environment.
7. Monitor free-tier usage and periodically export the database to a safe
   location. Confirm that restores work; provider recovery windows are not a
   substitute for independent backups.

Use separate development and production databases and credentials where
practical. Do not commit `.env` files or real credentials.

## Verification

- Creating and editing a word preserves `example` and `in_a_sentence`
  independently, including through an API import and display on a card.
- Missing required fields, malformed URLs, invalid arrays, oversized requests,
  and invalid JSON receive useful errors.
- Duplicate spellings, including case and Unicode normalization variants, are
  rejected consistently from both form and API, including concurrent imports.
- Unauthorized browsers, non-owner accounts, and requests with missing or
  invalid API keys cannot access protected operations.
- A mixed batch reports each entry accurately; a database failure is not
  presented as a successful import.
- A review transaction updates scheduling and records its event together;
  due selection, review intervals, daily counts, and streaks work across
  midnight and time-zone boundaries.
- A broken external image shows a fallback; no server-side image fetch occurs.
- Development and deployed builds pass the project's chosen checks and
  migrations run successfully against the intended database.

## Decisions and configuration

- Browser sign-in uses one configured username/password; assistant imports use
  a separate bearer key.
- The initial review time zone is `Asia/Kolkata`, and the daily focus timer is
  five minutes. Review intervals, random ordering, and the ten-card session
  cap use the defaults above.
- Exact input, batch, and API rate limits are documented above and in the
  README. Review the limits and provider free tiers before public deployment.
- The owner can define the editorial distinction between `example` and
  `in_a_sentence` for their assistant; the application preserves both fields
  without interpreting or generating them.
