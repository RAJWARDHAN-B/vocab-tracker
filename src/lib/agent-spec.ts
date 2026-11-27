import {
  AGENT_READ_RATE_LIMIT_MAX,
  IMPORT_RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_SECONDS,
} from "@/lib/rate-limit";
import { WORD_LIMITS } from "@/lib/validation";

export const AGENT_SPEC_VERSION = "1.0.0";
export const AGENT_LIST_DEFAULT_LIMIT = 50;
export const AGENT_LIST_MAX_LIMIT = 100;

export type AgentEndpointSpec = {
  method: "GET" | "POST";
  path: string;
  summary: string;
  rate_limit: {
    bucket: "agent-read" | "import";
    max_requests: number;
    window_seconds: number;
  };
  query_parameters?: Record<string, string>;
  path_parameters?: Record<string, string>;
  request_schema_ref?: string;
  response_summary: string;
  aliases?: string[];
};

export type AgentSpec = {
  name: string;
  version: string;
  description: string;
  base_url: string;
  authentication: {
    type: "bearer";
    header: string;
    required_on_all_endpoints: true;
    notes: string[];
  };
  capabilities: {
    allowed: string[];
    not_allowed: string[];
  };
  endpoints: AgentEndpointSpec[];
  limits: {
    max_body_bytes: number;
    max_batch_size: number;
    word_max_length: number;
    meaning_max_length: number;
    example_max_length: number;
    in_a_sentence_max_length: number;
    list_max_items: number;
    list_item_max_length: number;
    image_url_max_length: number;
    image_caption_max_length: number;
    list_default_limit: number;
    list_max_limit: number;
    import_requests_per_hour: number;
    read_requests_per_hour: number;
    rate_limit_window_seconds: number;
  };
  duplicate_detection: {
    normalization: string;
    behavior: string;
  };
  instructions: {
    workflow: string[];
    field_guidelines: Record<
      | "word"
      | "meaning"
      | "synonyms"
      | "antonyms"
      | "example"
      | "in_a_sentence"
      | "image_url"
      | "image_caption",
      string
    >;
    strict_rules: string[];
  };
  schemas: {
    $schema: string;
    WordInput: Record<string, unknown>;
    BatchUploadRequest: Record<string, unknown>;
    BatchUploadResponse: Record<string, unknown>;
    WordRecord: Record<string, unknown>;
  };
  examples: {
    batch_upload_request: Record<string, unknown>;
    batch_upload_response: Record<string, unknown>;
    word_record: Record<string, unknown>;
  };
};

export function resolveBaseUrl(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    const proto = forwardedProto?.split(",")[0]?.trim() || "https";
    return `${proto}://${forwardedHost.split(",")[0].trim()}`;
  }
  try {
    return new URL(request.url).origin;
  } catch {
    return "";
  }
}

export function buildAgentSpec(baseUrl = ""): AgentSpec {
  const wordInputSchemaJson = {
    type: "object",
    additionalProperties: false,
    required: ["word", "meaning", "example", "in_a_sentence"],
    properties: {
      word: {
        type: "string",
        minLength: 1,
        maxLength: WORD_LIMITS.wordMaxLength,
        description:
          "Required display spelling (trimmed; non-empty). Used to compute normalized_word for duplicate detection.",
      },
      meaning: {
        type: "string",
        minLength: 1,
        maxLength: WORD_LIMITS.meaningMaxLength,
        description: "Required clear definition of the word.",
      },
      synonyms: {
        type: "array",
        maxItems: WORD_LIMITS.listMaxItems,
        default: [],
        items: {
          type: "string",
          minLength: 1,
          maxLength: WORD_LIMITS.listItemMaxLength,
        },
        description:
          "Optional array of non-empty synonym strings. Omit or pass [] when none apply.",
      },
      antonyms: {
        type: "array",
        maxItems: WORD_LIMITS.listMaxItems,
        default: [],
        items: {
          type: "string",
          minLength: 1,
          maxLength: WORD_LIMITS.listItemMaxLength,
        },
        description:
          "Optional array of non-empty antonym strings. Omit or pass [] when none apply.",
      },
      example: {
        type: "string",
        minLength: 1,
        maxLength: WORD_LIMITS.exampleMaxLength,
        description:
          "Required example illustrating usage or nuance, stored independently from in_a_sentence.",
      },
      in_a_sentence: {
        type: "string",
        minLength: 1,
        maxLength: WORD_LIMITS.inASentenceMaxLength,
        description:
          "Required full natural sentence using the word in context, stored independently from example.",
      },
      image_url: {
        type: ["string", "null"],
        format: "uri",
        maxLength: WORD_LIMITS.imageUrlMaxLength,
        description:
          "Optional direct absolute HTTPS image URL with no embedded username/password. Use null (never an empty string) if no verified image URL is available.",
      },
      image_caption: {
        type: ["string", "null"],
        maxLength: WORD_LIMITS.imageCaptionMaxLength,
        description:
          "Optional brief caption or image attribution. Use null when absent.",
      },
    },
  };

  const batchUploadRequestSchemaJson = {
    type: "object",
    additionalProperties: false,
    required: ["words"],
    properties: {
      words: {
        type: "array",
        minItems: 1,
        maxItems: WORD_LIMITS.maxBatchSize,
        items: { $ref: "#/schemas/WordInput" },
      },
    },
  };

  const batchUploadResponseSchemaJson = {
    type: "object",
    required: ["results"],
    properties: {
      results: {
        type: "array",
        items: {
          oneOf: [
            {
              type: "object",
              required: ["index", "status", "id"],
              properties: {
                index: { type: "integer", minimum: 0 },
                status: { const: "created" },
                id: { type: "string", format: "uuid" },
              },
            },
            {
              type: "object",
              required: ["index", "status", "message"],
              properties: {
                index: { type: "integer", minimum: 0 },
                status: { const: "duplicate" },
                message: { type: "string" },
              },
            },
            {
              type: "object",
              required: ["index", "status", "errors"],
              properties: {
                index: { type: "integer", minimum: 0 },
                status: { const: "invalid" },
                errors: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["field", "message"],
                    properties: {
                      field: { type: "string" },
                      message: { type: "string" },
                    },
                  },
                },
              },
            },
          ],
        },
      },
    },
  };

  const wordRecordSchemaJson = {
    type: "object",
    required: [
      "id",
      "word",
      "normalized_word",
      "meaning",
      "synonyms",
      "antonyms",
      "example",
      "in_a_sentence",
      "image_url",
      "image_caption",
      "next_review_at",
      "review_interval_days",
      "created_at",
      "updated_at",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      word: { type: "string" },
      normalized_word: { type: "string" },
      meaning: { type: "string" },
      synonyms: { type: "array", items: { type: "string" } },
      antonyms: { type: "array", items: { type: "string" } },
      example: { type: "string" },
      in_a_sentence: { type: "string" },
      image_url: { type: ["string", "null"] },
      image_caption: { type: ["string", "null"] },
      next_review_at: { type: "string", format: "date-time" },
      review_interval_days: { type: "integer", minimum: 0 },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  };

  return {
    name: "Fern Vocabulary Agent API",
    version: AGENT_SPEC_VERSION,
    description:
      "Authenticated API for an AI assistant to inspect schema/instructions, read or search saved vocabulary words, and batch-upload new vocabulary entries into Fern.",
    base_url: baseUrl,
    authentication: {
      type: "bearer",
      header: "Authorization: Bearer <ASSISTANT_API_KEY>",
      required_on_all_endpoints: true,
      notes: [
        "Send the bearer token on every request over HTTPS.",
        "Never log, echo, or embed the API key in word fields or user-visible text.",
        "Missing or invalid keys return HTTP 401. If ASSISTANT_API_KEY is not configured on the server, endpoints return HTTP 503.",
      ],
    },
    capabilities: {
      allowed: [
        "Inspect API schema, limits, and instructions (GET /api/agent)",
        "List and search existing vocabulary words (GET /api/agent/words)",
        "Look up a single word by UUID or spelling (GET /api/agent/words/{id_or_word})",
        "Upload vocabulary words in batches of 1 to 50 (POST /api/agent/words or POST /api/words)",
      ],
      not_allowed: [
        "Updating or overwriting existing words (owner edits words in the web app)",
        "Deleting words",
        "Recording spaced-repetition reviews or modifying review schedules",
      ],
    },
    endpoints: [
      {
        method: "GET",
        path: "/api/agent",
        summary:
          "Returns this API specification, JSON Schemas, limits, and editorial instructions.",
        rate_limit: {
          bucket: "agent-read",
          max_requests: AGENT_READ_RATE_LIMIT_MAX,
          window_seconds: RATE_LIMIT_WINDOW_SECONDS,
        },
        query_parameters: {
          format:
            "Optional response format: 'json' (default) or 'markdown' (alias 'md'). You may also request Markdown with header 'Accept: text/markdown'.",
        },
        response_summary:
          "200 OK with structured JSON spec (application/json) or Markdown guide (text/markdown). 400 on unsupported format value.",
      },
      {
        method: "GET",
        path: "/api/agent/words",
        summary:
          "Lists saved words in reverse chronological order with optional substring search and pagination.",
        rate_limit: {
          bucket: "agent-read",
          max_requests: AGENT_READ_RATE_LIMIT_MAX,
          window_seconds: RATE_LIMIT_WINDOW_SECONDS,
        },
        query_parameters: {
          q: "Optional search string matched against word and normalized_word (truncated to 100 chars).",
          limit: `Optional integer between 1 and ${AGENT_LIST_MAX_LIMIT} (default ${AGENT_LIST_DEFAULT_LIMIT}).`,
          offset: "Optional non-negative integer offset (default 0).",
        },
        response_summary:
          "200 OK with { words: WordRecord[], total: number, limit: number, offset: number }. 400 on invalid pagination parameters.",
      },
      {
        method: "POST",
        path: "/api/agent/words",
        summary:
          "Uploads a batch of 1 to 50 vocabulary entries. Each entry is validated and saved independently.",
        rate_limit: {
          bucket: "import",
          max_requests: IMPORT_RATE_LIMIT_MAX,
          window_seconds: RATE_LIMIT_WINDOW_SECONDS,
        },
        request_schema_ref: "#/schemas/BatchUploadRequest",
        response_summary:
          "200 OK with { results: [...] } reporting created, duplicate, or invalid per input index. 400 on malformed JSON or invalid top-level payload; 413 if body exceeds 256 KiB; 429 if rate-limited.",
        aliases: ["POST /api/words"],
      },
      {
        method: "GET",
        path: "/api/agent/words/{id_or_word}",
        summary:
          "Fetches a single saved word by its UUID or by its spelling (URL-encoded if needed).",
        rate_limit: {
          bucket: "agent-read",
          max_requests: AGENT_READ_RATE_LIMIT_MAX,
          window_seconds: RATE_LIMIT_WINDOW_SECONDS,
        },
        path_parameters: {
          id_or_word:
            "A word UUID or spelling. Exact UUID match is checked first; otherwise the value is normalized (trim, Unicode NFKC, lowercase) and matched against normalized_word.",
        },
        response_summary:
          "200 OK with { word: WordRecord }, or 404 Not Found if no matching word exists.",
      },
    ],
    limits: {
      max_body_bytes: WORD_LIMITS.maxBodyBytes,
      max_batch_size: WORD_LIMITS.maxBatchSize,
      word_max_length: WORD_LIMITS.wordMaxLength,
      meaning_max_length: WORD_LIMITS.meaningMaxLength,
      example_max_length: WORD_LIMITS.exampleMaxLength,
      in_a_sentence_max_length: WORD_LIMITS.inASentenceMaxLength,
      list_max_items: WORD_LIMITS.listMaxItems,
      list_item_max_length: WORD_LIMITS.listItemMaxLength,
      image_url_max_length: WORD_LIMITS.imageUrlMaxLength,
      image_caption_max_length: WORD_LIMITS.imageCaptionMaxLength,
      list_default_limit: AGENT_LIST_DEFAULT_LIMIT,
      list_max_limit: AGENT_LIST_MAX_LIMIT,
      import_requests_per_hour: IMPORT_RATE_LIMIT_MAX,
      read_requests_per_hour: AGENT_READ_RATE_LIMIT_MAX,
      rate_limit_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    },
    duplicate_detection: {
      normalization:
        "trim() -> Unicode NFKC normalization -> toLowerCase()",
      behavior:
        "Uniqueness is enforced on normalized_word at the database level. Retrying or submitting an existing word returns { status: 'duplicate' } and never overwrites the existing entry.",
    },
    instructions: {
      workflow: [
        "1. Read GET /api/agent (JSON or ?format=markdown) when starting a session to confirm current fields, limits, and rules.",
        "2. Before uploading, optionally check whether a word already exists using GET /api/agent/words/{word} or GET /api/agent/words?q={term}.",
        "3. Prepare a JSON object { \"words\": [...] } with 1 to 50 entries following the WordInput schema and editorial guidelines below.",
        "4. POST the batch to /api/agent/words (or /api/words) with Content-Type: application/json and Authorization: Bearer <ASSISTANT_API_KEY>.",
        "5. Inspect every item in response.results: 'created' entries are saved and immediately due for review; 'duplicate' entries already exist and need no retry; fix field errors on any 'invalid' entries and re-submit only those.",
      ],
      field_guidelines: {
        word:
          "Use the canonical base form (lemma) in natural casing (e.g., 'ephemeral', 'ubiquitous'). Trim surrounding whitespace and omit pronunciation guides or trailing punctuation.",
        meaning:
          "Write a clear, concise 1-2 sentence definition in plain English capturing the primary sense the learner should retain. Avoid circular definitions that repeat the target word.",
        synonyms:
          "Provide 2-5 close, natural synonyms matching the part of speech of the meaning. Omit or send [] when no clean synonyms exist; avoid loose or tangential associations.",
        antonyms:
          "Provide 1-4 direct opposites matching the part of speech. Omit or send [] when the word has no natural antonym (for example, concrete nouns).",
        example:
          "DISTINCT FROM in_a_sentence. Provide a short, memorable usage phrase, collocation, or concrete real-world scenario that anchors the word's nuance (e.g., 'An ephemeral social-media trend that fades within a week.').",
        in_a_sentence:
          "DISTINCT FROM example. Write one complete, natural, self-contained sentence using the word in vivid context so the reader can infer its meaning from context clues. Never duplicate the text of example or leave either field empty.",
        image_url:
          "Optional direct absolute HTTPS URL to a real, hotlink-safe image (no HTTP, no embedded credentials, no guessed or placeholder URLs). Always pass null unless you have a verified image URL.",
        image_caption:
          "Optional short caption or attribution (e.g., 'Morning mist over a valley — photo via Unsplash'). Pass null when image_url is null or no caption is needed; do not invent attributions.",
      },
      strict_rules: [
        "Both 'example' and 'in_a_sentence' are required and preserved independently; never merge, omit, or copy one into the other.",
        "Schemas are strict (additionalProperties: false): do not include unknown or extra keys on the top-level payload or on any word object.",
        "Do not send empty strings for optional image fields — pass null or omit the key.",
        "Split large imports into batches of at most 50 words and keep each HTTP body under 256 KiB.",
        "Respect HTTP 429 responses and wait for the number of seconds in the Retry-After header before retrying.",
      ],
    },
    schemas: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      WordInput: wordInputSchemaJson,
      BatchUploadRequest: batchUploadRequestSchemaJson,
      BatchUploadResponse: batchUploadResponseSchemaJson,
      WordRecord: wordRecordSchemaJson,
    },
    examples: {
      batch_upload_request: {
        words: [
          {
            word: "ephemeral",
            meaning: "Lasting for a very short time; quickly passing away.",
            synonyms: ["fleeting", "transient", "brief"],
            antonyms: ["enduring", "lasting", "permanent"],
            example: "An ephemeral summer storm or viral trend.",
            in_a_sentence:
              "The rainbow proved ephemeral, dissolving into the pale sky before she could raise her camera.",
            image_url: null,
            image_caption: null,
          },
          {
            word: "laconic",
            meaning: "Using very few words; concise to the point of seeming terse.",
            synonyms: ["concise", "terse", "succinct"],
            antonyms: ["verbose", "wordy", "loquacious"],
            example: "A laconic one-word reply to a long message.",
            in_a_sentence:
              "Known for her laconic style, the judge summarized a three-hour argument in two crisp sentences.",
            image_url: null,
            image_caption: null,
          },
        ],
      },
      batch_upload_response: {
        results: [
          {
            index: 0,
            status: "created",
            id: "11111111-2222-4333-8444-555555555555",
          },
          {
            index: 1,
            status: "duplicate",
            message: "That normalized spelling already exists.",
          },
          {
            index: 2,
            status: "invalid",
            errors: [
              {
                field: "in_a_sentence",
                message: "Too small: expected string to have >=1 characters",
              },
            ],
          },
        ],
      },
      word_record: {
        id: "11111111-2222-4333-8444-555555555555",
        word: "ephemeral",
        normalized_word: "ephemeral",
        meaning: "Lasting for a very short time; quickly passing away.",
        synonyms: ["fleeting", "transient", "brief"],
        antonyms: ["enduring", "lasting", "permanent"],
        example: "An ephemeral summer storm or viral trend.",
        in_a_sentence:
          "The rainbow proved ephemeral, dissolving into the pale sky before she could raise her camera.",
        image_url: null,
        image_caption: null,
        next_review_at: "2026-11-27T05:30:00.000Z",
        review_interval_days: 0,
        created_at: "2026-11-27T05:30:00.000Z",
        updated_at: "2026-11-27T05:30:00.000Z",
      },
    },
  };
}

export function renderAgentSpecMarkdown(spec: AgentSpec): string {
  const lines: string[] = [
    `# ${spec.name} (v${spec.version})`,
    "",
    spec.description,
    "",
  ];

  if (spec.base_url) {
    lines.push(`**Base URL:** \`${spec.base_url}\``, "");
  }

  lines.push(
    "## Authentication",
    "",
    `- **Scheme:** Bearer token (\`${spec.authentication.header}\`)`,
    "- Required on **all** endpoints (including this instructions endpoint).",
    ...spec.authentication.notes.map((note) => `- ${note}`),
    "",
    "## Capabilities",
    "",
    "### Allowed",
    ...spec.capabilities.allowed.map((item) => `- ${item}`),
    "",
    "### Not allowed",
    ...spec.capabilities.not_allowed.map((item) => `- ${item}`),
    "",
    "## Endpoints",
    "",
  );

  for (const endpoint of spec.endpoints) {
    lines.push(`### \`${endpoint.method} ${endpoint.path}\``, "", endpoint.summary, "");
    if (endpoint.aliases?.length) {
      lines.push(
        `- **Aliases:** ${endpoint.aliases.map((alias) => `\`${alias}\``).join(", ")}`,
      );
    }
    lines.push(
      `- **Rate limit:** ${endpoint.rate_limit.max_requests} requests / ${endpoint.rate_limit.window_seconds}s (\`${endpoint.rate_limit.bucket}\` bucket)`,
    );
    if (endpoint.path_parameters) {
      lines.push("- **Path parameters:**");
      for (const [key, desc] of Object.entries(endpoint.path_parameters)) {
        lines.push(`  - \`${key}\`: ${desc}`);
      }
    }
    if (endpoint.query_parameters) {
      lines.push("- **Query parameters:**");
      for (const [key, desc] of Object.entries(endpoint.query_parameters)) {
        lines.push(`  - \`${key}\`: ${desc}`);
      }
    }
    if (endpoint.request_schema_ref) {
      lines.push(`- **Request body schema:** \`${endpoint.request_schema_ref}\``);
    }
    lines.push(`- **Response:** ${endpoint.response_summary}`, "");
  }

  lines.push(
    "## Workflow",
    "",
    ...spec.instructions.workflow,
    "",
    "## Field Guidelines",
    "",
    ...Object.entries(spec.instructions.field_guidelines).map(
      ([field, guidance]) => `- **\`${field}\`**: ${guidance}`,
    ),
    "",
    "## Strict Rules",
    "",
    ...spec.instructions.strict_rules.map((rule) => `- ${rule}`),
    "",
    "## Limits & Duplicate Detection",
    "",
    `- **Max request body:** ${spec.limits.max_body_bytes} bytes (256 KiB)`,
    `- **Max words per batch:** ${spec.limits.max_batch_size}`,
    `- **Field max lengths:** \`word\` ${spec.limits.word_max_length}, \`meaning\` ${spec.limits.meaning_max_length}, \`example\` ${spec.limits.example_max_length}, \`in_a_sentence\` ${spec.limits.in_a_sentence_max_length}, \`image_url\` ${spec.limits.image_url_max_length}, \`image_caption\` ${spec.limits.image_caption_max_length}`,
    `- **List limits:** up to ${spec.limits.list_max_items} items per \`synonyms\`/\`antonyms\` array, max ${spec.limits.list_item_max_length} chars each`,
    `- **Duplicate normalization:** \`${spec.duplicate_detection.normalization}\` — ${spec.duplicate_detection.behavior}`,
    "",
    "## JSON Schemas (Draft 2020-12)",
    "",
    "```json",
    JSON.stringify(spec.schemas, null, 2),
    "```",
    "",
    "## Example: Batch Upload Request",
    "",
    "```json",
    JSON.stringify(spec.examples.batch_upload_request, null, 2),
    "```",
    "",
    "## Example: Batch Upload Response",
    "",
    "```json",
    JSON.stringify(spec.examples.batch_upload_response, null, 2),
    "```",
    "",
  );

  return lines.join("\n");
}
