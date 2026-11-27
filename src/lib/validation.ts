import { z } from "zod";

export const WORD_LIMITS = {
  maxBodyBytes: 256 * 1024,
  maxBatchSize: 50,
  wordMaxLength: 200,
  meaningMaxLength: 2000,
  exampleMaxLength: 2000,
  inASentenceMaxLength: 2000,
  listMaxItems: 50,
  listItemMaxLength: 100,
  imageUrlMaxLength: 2048,
  imageCaptionMaxLength: 500,
} as const;

const requiredText = (limit: number) => z.string().trim().min(1).max(limit);
const optionalImageUrl = z
  .union([z.string().max(WORD_LIMITS.imageUrlMaxLength), z.null()])
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
  word: requiredText(WORD_LIMITS.wordMaxLength),
  meaning: requiredText(WORD_LIMITS.meaningMaxLength),
  synonyms: z
    .array(requiredText(WORD_LIMITS.listItemMaxLength))
    .max(WORD_LIMITS.listMaxItems)
    .default([]),
  antonyms: z
    .array(requiredText(WORD_LIMITS.listItemMaxLength))
    .max(WORD_LIMITS.listMaxItems)
    .default([]),
  example: requiredText(WORD_LIMITS.exampleMaxLength),
  in_a_sentence: requiredText(WORD_LIMITS.inASentenceMaxLength),
  image_url: optionalImageUrl,
  image_caption: z
    .union([z.string().trim().max(WORD_LIMITS.imageCaptionMaxLength), z.null()])
    .optional(),
};

export const wordInputSchema = z.object(wordFields).strict();
export const importRequestSchema = z
  .object({
    words: z.array(z.unknown()).min(1).max(WORD_LIMITS.maxBatchSize),
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
