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
| `tag` | `TEXT`, nullable | Optional part-of-speech / lexical tag (`noun`, `verb`, `adjective`, `adverb`, `pronoun`, `preposition`, `conjunction`, `interjection`, `idiom`, `phrase`). |
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

## Interactive practice roadmap

### Status and objective

**Planning only:** the following phases are proposed, not implemented. They
extend Fern with short, varied, visual vocabulary exercises inspired by the
interaction patterns in the supplied reference: choosing a picture, completing
a phrase with word tiles, and spelling with letter tiles. Use Fern's own
branding, assets, and layouts rather than copying another app's artwork or
interface.

The current app already provides a searchable word collection, optional
part-of-speech tags, a reveal-and-rate review deck, a daily focus timer, and an
assistant import API. The new practice experience uses those saved words; it is
not a translation course and does not require the assistant or a paid AI
service at practice time.

**Proposed defaults, subject to owner feedback:**

- Offer a separate **Practice** entry point alongside the existing review.
  Choose all words or a part-of-speech tag; optionally prioritize due words.
- Start with a finite session of up to 10 answerable questions. Allow the user
  to finish early; do not impose a time limit or block future practice.
- Practice attempts and summaries are separate from spaced-repetition reviews.
  They do **not** create `reviews`, change review schedules or streaks, or
  complete the existing five-minute focus timer. Keep all existing behavior.
- Resume an unfinished session after a refresh or on another device. Only one
  active practice session is allowed for this single-owner app; starting another
  offers resume or explicit abandonment, not silent replacement.
- Use the word's existing content. Do not invent examples, image URLs,
  translations, or audio. A word can participate in some modes even when other
  modes are unavailable.

### Exercise catalogue

Each exercise includes a prompt, selectable or typed answer, explicit feedback,
the correct answer after an incorrect attempt, and a way to continue. Randomize
choice order; never use color alone to convey correctness. Display the word's
tag when present. Exercise generation must be deterministic after a question is
created, including its answer choices and order, so a resumed session presents
the same question.

| Mode | Prompt and interaction | Eligibility and safe fallback |
| --- | --- | --- |
| Meaning choice | Show a word and ask the learner to choose its meaning from one correct answer and three distractors from other words. | Require four distinct, non-empty normalized meanings. Prefer the same tag for distractors when available, but allow other tags. Avoid duplicates and identical-looking choices; if unavailable, choose another eligible mode. |
| Word choice | Show a meaning and ask the learner to select the corresponding word from four word choices. | Require four distinct normalized spellings. Do not offer this mode if another option has the same normalized meaning as the prompt or if the choices would reveal multiple valid answers. |
| Spelling | Show the meaning and optionally the tag; assemble the word with shuffled letter tiles, with an accessible text-input alternative. | Use Unicode grapheme clusters, not UTF-16 code units, for tiles. Preserve spaces, punctuation and repeated letters; permit entry and correction without a drag gesture. Initially restrict tiles to words for which this is unambiguous and practical (for example, short single words); offer text input or another mode for other entries. |
| Sentence completion | Show `in_a_sentence` with one exact whole-word occurrence of the target blanked; choose the missing word from four choices. | Generate only when a case-insensitive, boundary-aware match is safe and the sentence has exactly one match. Preserve the original sentence for feedback; never rewrite it or substitute `example`. Skip inflections, ambiguous matches and sentences that do not contain the stored spelling. |
| Synonym or antonym choice | Ask for a synonym or antonym of the word; select one stored relation from four choices. | Require a non-empty relevant list and three distinct distractors that are neither the target nor any stored synonym or antonym. Use normalized comparisons; do not claim generated distractors are guaranteed semantically wrong. Disable the question when safe choices cannot be established. |
| Picture choice | Show a word and choose its matching image among four labeled images. | Require four distinct saved HTTPS image URLs with meaningful alternative text or captions and enough unambiguous options. Load only in the browser, never proxy or fetch image URLs on the server. If any image fails or has unsuitable attribution, replace the exercise with an eligible text mode; never guess an image. |

Modes are suggestions for implementation, not a promise that every saved word
is eligible. Prioritize unambiguous questions; when data cannot establish a
single correct answer, omit the question. Start with meaning/word choice and
spelling, then add the remaining modes in later phases.

### Shared session design

#### Selection and exercise generation

1. Fetch the selected collection on the server. The optional tag filter uses
   the existing `words.tag` enum; untagged words remain usable when no tag is
   selected. The proposed default order mixes due and other saved words, with
   due words first when the user chooses that option.
2. Build an eligibility pool per mode and select at most 10 questions from it.
   The scope determines target words; distractors may come from the full
   collection so a small tag-filtered collection can still yield valid choices.
   Prefer different targets and modes; never promise a fixed exercise mix.
3. If fewer than 10 safe questions exist, state the actual count before
   starting. If none exist, show an actionable empty state, such as adding more
   distinct words or clearing the tag filter. Do not manufacture choices.
4. Persist the generated questions and their answer keys before exposing the
   session. Shuffle with a server-generated seed or persist the shuffled
   snapshot. A question's prompt, choices, expected answer and source word
   snapshot remain stable if a word is edited while the session is active.

For comparison, trim and apply Unicode NFKC and lowercase consistently with
the existing word normalization; define punctuation and whitespace treatment
per mode and show the expected spelling in feedback. Do not use fuzzy matching
or silently accept synonyms for a question expecting a specific word. For
letter tiles, track tile instance IDs so repeated letters are independently
selectable. Design around words that have multiple senses: the stored meaning
and tag describe the intended sense, not a universal linguistic truth.

#### Proposed persistence

Use additive Drizzle migrations and UTC ISO timestamps; do not alter existing
words, reviews, or timer rows. The names and fields below describe the intended
contract; refine them during implementation without changing the user-visible
invariants.

- `practice_sessions`: UUID `id`, `status` (`active`, `completed`, or
  `abandoned`), filter/selection settings, `started_at`, nullable `ended_at`,
  and planned question count. Enforce at most one `active` row using a
  database-level partial unique index appropriate to SQLite/libSQL.
- `practice_questions`: UUID `id`, `session_id` foreign key, zero-based
  `position`, exercise type, nullable source `word_id`, and a versioned JSON
  snapshot containing prompt, choices, answer key and feedback content. Enforce
  unique `(session_id, position)`. Use `ON DELETE SET NULL` for the source word
  if deletion is supported later; the snapshot remains sufficient for resume.
- `practice_attempts`: UUID `id`, `question_id` foreign key with a unique
  constraint, submitted answer or explicit skip, server-evaluated outcome
  (`correct`, `incorrect`, or `skipped`), and `answered_at`. Do not record a
  new attempt every time a client retries the same submission.

The server is the authority for question eligibility, progression and
correctness. Do not expose private database credentials, use client-provided
correctness flags, or treat a client timer as trusted state. Practice is
owner-only: the assistant bearer key does not grant access to practice data.

#### Proposed API and state transitions

Routes are illustrative and should follow the existing Next.js route-handler,
owner-session and same-origin patterns:

- `POST /api/practice/sessions`: validate filters, generate a safe question
  set, and create the session and questions atomically. Return the session ID,
  planned count and first question. Return a clear empty-eligibility response
  when no questions can be built, or `409` with the active session ID when
  another session already exists.
- `GET /api/practice/sessions/:id`: return session status, progress and current
  question or completed summary. Fetching an unknown session returns `404`.
  Do not expose answer keys in an unanswered question's response.
- `POST /api/practice/sessions/:id/answers`: accept a question ID and a
  mode-appropriate answer or explicit skip. In one transaction check the
  active session and current position, validate and grade against the saved
  answer key, insert the attempt, and return feedback and the next question or
  completion summary. A duplicate submission of the same answer returns the
  existing result; a conflicting or out-of-order answer returns `409`. Skip
  records `skipped`, never `correct`.
- `POST /api/practice/sessions/:id/finish`: finish early as `completed` or
  explicitly abandon as `abandoned`; return the persisted status and summary.
  Repeating the same terminal action is safe; conflicting terminal actions
  return `409`. Handle two tabs or lost responses without duplicate attempts.

On the last accepted answer, atomically transition `active` to `completed`.
An early finish leaves unanswered questions unanswered; an abandoned session
retains its attempts but is not reported as completed. Report server errors
explicitly and keep the current input available for retry. The client must not
show an answer as saved until the server confirms it.

#### UX, accessibility and privacy

- Design a responsive, mobile-first practice screen with one focused prompt,
  large touch targets, visible progress (`answered / planned`), a back/finish
  control, feedback, and a concise completion summary. Retain the existing
  navigation and adapt to desktop widths.
- Make every interaction usable with a keyboard and screen reader. Provide
  visible focus, accessible labels, non-color-only feedback, logical focus
  movement, and reduced-motion behavior. Letter tiles must have a keyboard
  alternative; any animation must be optional and non-blocking.
- An image is optional enrichment, never the sole way to complete a session.
  Show a safe fallback for missing or broken images and preserve attribution.
  External image requests reveal the viewer's IP address to the image host.
- Keep practice records private and avoid logging answer payloads or
  credentials. Cap request and answer sizes, validate all identifiers and
  payloads, and apply same-origin checks to every mutation.

### Phase 0: Product and interaction validation

**Goal:** validate the experience before building persistence or changing
existing review behavior.

- Sketch the entry point, session setup, question, feedback, resume, early-finish
  and summary states using Fern's existing styling.
- Review the exercise catalogue against real saved words: check meaning
  overlap, short collections, sentences without an exact target, phrase tags,
  repeated letters and image availability.
- Confirm with the owner whether practice should remain separate from review
  scheduling and the daily timer, and whether the proposed 10-question limit
  and exercise priority are desirable. These are defaults, not existing
  behavior.
- Define the accessible text alternative and test the proposed experience on
  narrow mobile screens and desktop.

**Exit:** agreed scope and exercise priorities, identified data limitations,
and explicit decisions on review/timer integration. Do not implement review
integration without that decision.

### Phase 1: Practice engine and persistence

**Goal:** a reliable, resumable practice session backed by existing words.

- Add versioned schema/migrations for sessions, questions and attempts; test a
  migration from a populated database without modifying existing word/review
  data. Implement transactional creation, grading and state transitions.
- Add pure, testable eligibility, selection and grading helpers for meaning
  and word choice. Persist all selected question data and validate the shape of
  each versioned snapshot before use.
- Implement the owner-authenticated routes above, including same-origin
  protections, request validation, session conflict handling, retry-safe
  submissions, and explicit empty/error responses.
- Use a simple internal or minimal UI flow to start, answer, skip, resume and
  finish a session; leave the existing `/review` and study timer unchanged.

**Exit:** a session survives refresh, rejects cross-session/out-of-order
answers, grades server-side, has no duplicate attempts on retries, and leaves
existing review counts, streaks and schedules unchanged.

### Phase 2: Polished core practice experience

**Depends on:** Phase 1.

- Add the Practice navigation entry and a session setup screen with collection,
  tag and optional due-priority controls. Explain the actual question count
  and let users resume or abandon the existing session.
- Build reusable question, choice, feedback, progress and summary components.
  Present meaning-choice and word-choice exercises with explicit correct,
  incorrect and skipped states. Show the correct answer after submission.
- Add spelling exercises with repeated-letter-safe tile selection and the
  keyboard/text-input alternative. Restrict unsuitable words and fall back to
  other eligible modes rather than hiding or corrupting characters.
- Show completed, early-finished, abandoned, loading, insufficient-data and
  network-error states. Support retry without silently losing input.

**Exit:** the full setup-to-summary flow works on mobile and desktop, all
controls are keyboard accessible, and a session with eligible words can be
completed or resumed without impacting existing review.

### Phase 3: More exercise variety

**Depends on:** Phase 2.

- Add sentence completion using safe exact matching, preserving the original
  `in_a_sentence` independently from `example`. Use word tiles as an
  alternative to conventional choice buttons, without requiring dragging.
- Add synonym and antonym exercises only where choices are defensible using
  saved data. When correctness is uncertain, omit that question rather than
  generating plausible-looking but potentially valid distractors.
- Add picture choice only for collections with enough suitable, distinct
  images. Detect failed browser loads and switch to an eligible text mode
  without recording an incorrect response. Persist any replacement before
  continuing so refresh remains consistent.
- Exercise selection balances available modes without blocking a small or
  partially populated collection. Preserve original questions and results for
  already answered items.

**Exit:** each enabled mode has tests for eligibility and ambiguous data;
missing images, unrelated synonyms, absent exact sentence matches and small
collections never yield a misleading or unanswerable question.

### Phase 4: Practice progress and optional timed flow

**Depends on:** Phase 2; Phase 3 is optional.

- Add practice-specific dashboard summaries derived from persisted attempts:
  completed sessions, answered questions, correct, incorrect and skipped.
  Accuracy is `correct / (correct + incorrect)`; show no percentage when the
  denominator is zero. Keep practice activity distinct from review streaks.
- Convert UTC timestamps to the configured IANA time zone for daily summaries,
  and test dates across local midnight and daylight-saving transitions.
- Only after owner approval, consider a timed practice mode or explicit
  connection to the existing five-minute timer. Specify pause/resume,
  backgrounding, refresh, midnight, expiry and early-exit behavior before
  implementing. The current daily timer is a separate, once-per-day server
  record, not a practice-session countdown.
- Consider audio, adaptive difficulty, multiple senses, or imported
  practice-specific media later, with separate design and licensing decisions.

**Exit:** summaries reconcile with stored attempts across time zones, clearly
label practice versus reviews, and do not silently change the daily timer or
review streak.

### Verification and rollout checklist

- Unit tests: normalization, duplicate and ambiguous choices, eligibility,
  no-image cases, repeated graphemes, exact sentence boundaries, all tags and
  untagged words, and progress calculations.
- Route/integration tests: authentication and same-origin rejection, migration
  from existing data, create/resume/finish, simultaneous starts, double-submit
  and lost-response retries, skipped/invalid/out-of-order answers, edited or
  removed source words, database errors, and terminal-state conflicts.
- UX checks: touch and keyboard use, screen-reader labels and feedback,
  contrast, reduced motion, narrow viewports, broken images, refresh, offline
  recovery and a collection too small for a given mode.
- Regression checks: existing word import and editing, review scheduling,
  streaks, daily timer and owner access remain unchanged. Run the existing
  lint, typecheck, test and build commands.
- Deploy additive migrations to the intended development database first,
  verify backups and restore procedures, then migrate the intended production
  Turso database before enabling the UI. Verify the actual configured target;
  do not assume a local migration updated the remote database. If rollout is
  interrupted, leave existing review available and disable the new entry point
  until the schema and application version are compatible.

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

## Assistant agent API

### Endpoints and authentication

- Discovery, schema, and instructions: `GET /api/agent` (JSON by default;
  `?format=markdown` or `Accept: text/markdown` for Markdown).
- List/search saved words: `GET /api/agent/words` (`?q=`, `?tag=`, `?limit=`, `?offset=`).
- Fetch a single word by UUID or normalized spelling:
  `GET /api/agent/words/:id_or_word`.
- Batch upload words: `POST /api/agent/words` (with `POST /api/words` retained
  as a compatible alias).
- All assistant endpoints require `Authorization: Bearer <API_KEY>` over HTTPS.
- Generate a long random key, store it as a server-only Vercel environment
  variable, and provide it to the assistant through its secure secret storage.
  Do not put the key in source control, frontend bundles, examples, or a
  checked-in instruction file.
- Validate the key on the server using a timing-safe comparison. Reject a
  missing or invalid key with `401` before processing the request.
- Support key rotation by updating the server secret and assistant secret.
  Never log the key, authorization header, or full secret-bearing request.
- Apply an appropriate request-size limit and persistent libSQL rate limits
  before exposing the endpoints publicly (60 import requests/hour and 180 read
  requests/hour per key); an in-memory counter is not reliable across
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
