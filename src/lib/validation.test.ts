import { describe, expect, it } from "vitest";
import {
  normalizeWord,
  toWordInput,
  wordInputSchema,
} from "@/lib/validation";
import { localDateKey, reviewStreak } from "@/lib/time";

describe("word input", () => {
  it("keeps example and in_a_sentence independent", () => {
    const parsed = wordInputSchema.parse({
      word: "  Ephemeral ",
      meaning: "Brief.",
      example: "An ephemeral trend.",
      in_a_sentence: "The light was ephemeral.",
    });

    expect(toWordInput(parsed)).toMatchObject({
      example: "An ephemeral trend.",
      inASentence: "The light was ephemeral.",
      synonyms: [],
      antonyms: [],
    });
  });

  it("normalizes Unicode compatibility forms for duplicate detection", () => {
    expect(normalizeWord("  ＡLＰＨＡ ")).toBe("alpha");
  });

  it("rejects image URLs with embedded credentials", () => {
    const result = wordInputSchema.safeParse({
      word: "sample",
      meaning: "A sample.",
      example: "An example.",
      in_a_sentence: "A sentence.",
      image_url: "https://user:password@example.com/image.png",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional enum tags and rejects unsupported tag values", () => {
    const omitted = wordInputSchema.parse({
      word: "sample",
      meaning: "A sample.",
      example: "An example.",
      in_a_sentence: "A sentence.",
    });
    expect(toWordInput(omitted).tag).toBeNull();

    const valid = wordInputSchema.parse({
      word: "sprint",
      tag: "verb",
      meaning: "Run at full speed over a short distance.",
      example: "Sprint to the finish line.",
      in_a_sentence: "She had to sprint to catch the last train.",
    });
    expect(toWordInput(valid).tag).toBe("verb");

    const invalid = wordInputSchema.safeParse({
      word: "sprint",
      tag: "slang",
      meaning: "Run fast.",
      example: "Sprint.",
      in_a_sentence: "She will sprint.",
    });
    expect(invalid.success).toBe(false);
  });
});

describe("daily progress time boundaries", () => {
  it("uses the configured IANA time zone for calendar days", () => {
    expect(localDateKey(new Date("2026-01-02T18:45:00.000Z"), "Asia/Kolkata"))
      .toBe("2026-01-03");
  });

  it("keeps a streak through yesterday, but not across a missing day", () => {
    expect(reviewStreak(["2026-01-01", "2026-01-02"], "2026-01-03")).toBe(2);
    expect(reviewStreak(["2026-01-01"], "2026-01-03")).toBe(0);
  });
});
