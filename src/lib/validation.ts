import { z } from "zod";

const requiredText = (limit: number) => z.string().trim().min(1).max(limit);
const optionalImageUrl = z
  .union([z.string().max(2048), z.null()])
  .optional()
  .refine((value) => {
    if (value == null) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Enter an absolute HTTPS image URL without embedded credentials.");

const wordFields = {
  word: requiredText(200),
  meaning: requiredText(2000),
  synonyms: z.array(requiredText(100)).max(50).default([]),
  antonyms: z.array(requiredText(100)).max(50).default([]),
  example: requiredText(2000),
  in_a_sentence: requiredText(2000),
  image_url: optionalImageUrl,
  image_caption: z.union([z.string().trim().max(500), z.null()]).optional(),
};

export const wordInputSchema = z.object(wordFields).strict();
export const importRequestSchema = z
  .object({
    words: z.array(z.unknown()).min(1).max(50),
  })
  .strict();

export type WordInput = z.infer<typeof wordInputSchema>;

export function normalizeWord(word: string) {
  return word.trim().normalize("NFKC").toLowerCase();
}

export function toWordInput(value: WordInput) {
  return {
    word: value.word,
    meaning: value.meaning,
    synonyms: value.synonyms,
    antonyms: value.antonyms,
    example: value.example,
    inASentence: value.in_a_sentence,
    imageUrl: value.image_url || null,
    imageCaption: value.image_caption || null,
  };
}

export function formatValidationErrors(error: z.ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.length ? issue.path.join(".") : "request",
    message: issue.message,
  }));
}
