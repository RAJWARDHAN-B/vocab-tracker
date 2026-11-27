import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.TURSO_DATABASE_URL = "file::memory:";
  delete process.env.TURSO_AUTH_TOKEN;
});

vi.mock("@/lib/auth", () => ({
  isOwnerSignedIn: vi.fn().mockResolvedValue(false),
  sameOriginRequest: vi.fn().mockReturnValue(true),
}));

import { migrate } from "drizzle-orm/libsql/migrator";
import { client, db, enableForeignKeys } from "@/db/client";
import { GET as getAgentSpec } from "@/app/api/agent/route";
import {
  GET as listAgentWords,
  POST as postAgentWords,
} from "@/app/api/agent/words/route";
import { GET as getAgentWord } from "@/app/api/agent/words/[id]/route";
import { POST as postLegacyWords } from "@/app/api/words/route";
import {
  importRequestSchema,
  WORD_LIMITS,
  wordInputSchema,
} from "@/lib/validation";

const TEST_API_KEY = "test-assistant-api-key-0123456789abcdef";

function authHeaders(extra?: Record<string, string>) {
  return {
    Authorization: `Bearer ${TEST_API_KEY}`,
    ...extra,
  };
}

const sampleWord = {
  word: "Ephemeral",
  meaning: "Lasting for a very short time.",
  synonyms: ["fleeting", "transient"],
  antonyms: ["enduring", "lasting"],
  example: "An ephemeral summer trend.",
  in_a_sentence: "The rainbow proved ephemeral, vanishing within minutes.",
  image_url: null,
  image_caption: null,
};

beforeAll(async () => {
  await enableForeignKeys();
  await migrate(db, { migrationsFolder: "./drizzle" });
});

beforeEach(async () => {
  process.env.ASSISTANT_API_KEY = TEST_API_KEY;
  await client.execute("DELETE FROM reviews");
  await client.execute("DELETE FROM words");
  await client.execute("DELETE FROM api_rate_limits");
});

describe("AI agent authentication", () => {
  it("rejects missing or invalid bearer tokens with 401 across agent endpoints", async () => {
    const requests = [
      () => getAgentSpec(new Request("http://localhost:3000/api/agent")),
      () =>
        getAgentSpec(
          new Request("http://localhost:3000/api/agent", {
            headers: { Authorization: "Bearer wrong-key" },
          }),
        ),
      () =>
        listAgentWords(new Request("http://localhost:3000/api/agent/words")),
      () =>
        postAgentWords(
          new Request("http://localhost:3000/api/agent/words", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ words: [sampleWord] }),
          }),
        ),
      () =>
        getAgentWord(
          new Request("http://localhost:3000/api/agent/words/ephemeral"),
          { params: Promise.resolve({ id: "ephemeral" }) },
        ),
    ];

    for (const run of requests) {
      const response = await run();
      expect(response.status).toBe(401);
    }
  });

  it("returns 503 when ASSISTANT_API_KEY is not configured", async () => {
    delete process.env.ASSISTANT_API_KEY;
    const response = await getAgentSpec(
      new Request("http://localhost:3000/api/agent", {
        headers: authHeaders(),
      }),
    );
    expect(response.status).toBe(503);
  });
});

describe("GET /api/agent", () => {
  it("returns structured JSON instructions and schemas aligned with validation", async () => {
    const response = await getAgentSpec(
      new Request("https://fern.example/api/agent", {
        headers: authHeaders(),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("vary")).toContain("Accept");
    expect(response.headers.get("x-ratelimit-limit")).toBe("180");

    const spec = await response.json();
    expect(spec.base_url).toBe("https://fern.example");
    expect(spec.authentication.required_on_all_endpoints).toBe(true);
    expect(spec.limits.max_batch_size).toBe(WORD_LIMITS.maxBatchSize);
    expect(spec.limits.max_body_bytes).toBe(WORD_LIMITS.maxBodyBytes);
    expect(spec.endpoints.map((e: { path: string }) => e.path)).toEqual([
      "/api/agent",
      "/api/agent/words",
      "/api/agent/words",
      "/api/agent/words/{id_or_word}",
    ]);

    // Ensure the documented example batch actually passes real server validation.
    const parsedBatch = importRequestSchema.safeParse(
      spec.examples.batch_upload_request,
    );
    expect(parsedBatch.success).toBe(true);
    if (parsedBatch.success) {
      for (const entry of parsedBatch.data.words) {
        expect(wordInputSchema.safeParse(entry).success).toBe(true);
      }
    }
  });

  it("returns Markdown via ?format=markdown or Accept: text/markdown", async () => {
    const byQuery = await getAgentSpec(
      new Request("http://localhost:3000/api/agent?format=markdown", {
        headers: authHeaders(),
      }),
    );
    expect(byQuery.status).toBe(200);
    expect(byQuery.headers.get("content-type")).toContain("text/markdown");
    const markdown = await byQuery.text();
    expect(markdown).toContain("# Fern Vocabulary Agent API");
    expect(markdown).toContain("`POST /api/agent/words`");
    expect(markdown).toContain("`in_a_sentence`");

    const byAccept = await getAgentSpec(
      new Request("http://localhost:3000/api/agent", {
        headers: authHeaders({ Accept: "text/markdown, application/json;q=0.5" }),
      }),
    );
    expect(byAccept.status).toBe(200);
    expect(byAccept.headers.get("content-type")).toContain("text/markdown");
  });

  it("returns 400 for an unsupported format query parameter", async () => {
    const response = await getAgentSpec(
      new Request("http://localhost:3000/api/agent?format=xml", {
        headers: authHeaders(),
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe("Agent word upload, list, search, and lookup", () => {
  it("uploads a mixed batch via POST /api/agent/words and preserves field independence", async () => {
    const response = await postAgentWords(
      new Request("http://localhost:3000/api/agent/words", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          words: [
            sampleWord,
            // Duplicate via Unicode NFKC + case variant in same batch
            { ...sampleWord, word: "  ｅｐｈｅｍｅｒａｌ " },
            // Invalid: missing in_a_sentence
            {
              word: "laconic",
              meaning: "Using very few words.",
              example: "A laconic reply.",
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ratelimit-limit")).toBe("60");
    const body = await response.json();
    expect(body.results).toHaveLength(3);
    expect(body.results[0]).toMatchObject({ index: 0, status: "created" });
    expect(typeof body.results[0].id).toBe("string");
    expect(body.results[1]).toMatchObject({ index: 1, status: "duplicate" });
    expect(body.results[2]).toMatchObject({ index: 2, status: "invalid" });
    expect(body.results[2].errors[0].field).toBe("in_a_sentence");

    // Verify GET /api/agent/words/[id] works by UUID and by normalized spelling
    const createdId = body.results[0].id as string;
    const byIdRes = await getAgentWord(
      new Request(`http://localhost:3000/api/agent/words/${createdId}`, {
        headers: authHeaders(),
      }),
      { params: Promise.resolve({ id: createdId }) },
    );
    expect(byIdRes.status).toBe(200);
    const byIdBody = await byIdRes.json();
    expect(byIdBody.word).toMatchObject({
      id: createdId,
      word: "Ephemeral",
      normalized_word: "ephemeral",
      example: sampleWord.example,
      in_a_sentence: sampleWord.in_a_sentence,
      synonyms: sampleWord.synonyms,
      antonyms: sampleWord.antonyms,
      image_url: null,
      image_caption: null,
    });

    const bySpellingRes = await getAgentWord(
      new Request("http://localhost:3000/api/agent/words/EPHEMERAL", {
        headers: authHeaders(),
      }),
      { params: Promise.resolve({ id: "  ＥＰＨＥＭＥＲＡＬ " }) },
    );
    expect(bySpellingRes.status).toBe(200);
    expect((await bySpellingRes.json()).word.id).toBe(createdId);

    const missingRes = await getAgentWord(
      new Request("http://localhost:3000/api/agent/words/nonexistent", {
        headers: authHeaders(),
      }),
      { params: Promise.resolve({ id: "nonexistent" }) },
    );
    expect(missingRes.status).toBe(404);
  });

  it("lists, searches, and paginates words via GET /api/agent/words and keeps POST /api/words compatible", async () => {
    const uploadRes = await postLegacyWords(
      new Request("http://localhost:3000/api/words", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          words: [
            sampleWord,
            {
              word: "Laconic",
              meaning: "Using very few words.",
              synonyms: ["terse"],
              antonyms: ["verbose"],
              example: "A laconic shrug.",
              in_a_sentence: "His laconic email settled the debate in one line.",
            },
          ],
        }),
      }),
    );
    expect(uploadRes.status).toBe(200);

    const listRes = await listAgentWords(
      new Request("http://localhost:3000/api/agent/words?limit=1&offset=0", {
        headers: authHeaders(),
      }),
    );
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.total).toBe(2);
    expect(listBody.limit).toBe(1);
    expect(listBody.offset).toBe(0);
    expect(listBody.words).toHaveLength(1);

    const searchRes = await listAgentWords(
      new Request("http://localhost:3000/api/agent/words?q=lacon", {
        headers: authHeaders(),
      }),
    );
    expect(searchRes.status).toBe(200);
    const searchBody = await searchRes.json();
    expect(searchBody.total).toBe(1);
    expect(searchBody.words[0].word).toBe("Laconic");

    const badLimit = await listAgentWords(
      new Request("http://localhost:3000/api/agent/words?limit=500", {
        headers: authHeaders(),
      }),
    );
    expect(badLimit.status).toBe(400);

    const badOffset = await listAgentWords(
      new Request("http://localhost:3000/api/agent/words?offset=-1", {
        headers: authHeaders(),
      }),
    );
    expect(badOffset.status).toBe(400);
  });

  it("rejects oversized bodies with 413 and malformed JSON with 400", async () => {
    const malformed = await postAgentWords(
      new Request("http://localhost:3000/api/agent/words", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: "{not-json",
      }),
    );
    expect(malformed.status).toBe(400);

    const oversized = await postAgentWords(
      new Request("http://localhost:3000/api/agent/words", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: "x".repeat(WORD_LIMITS.maxBodyBytes + 1),
      }),
    );
    expect(oversized.status).toBe(413);
  });
});
