"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { WORD_TAGS, type WordInput, type WordTag } from "@/lib/validation";

type InitialWord = {
  id: string;
  word: string;
  tag: WordTag | null;
  meaning: string;
  synonyms: string[];
  antonyms: string[];
  example: string;
  inASentence: string;
  imageUrl: string | null;
  imageCaption: string | null;
};

type Props = { initialWord?: InitialWord };

export function WordForm({ initialWord }: Props) {
  const router = useRouter();
  const [word, setWord] = useState(initialWord?.word ?? "");
  const [tag, setTag] = useState<WordTag | "">(initialWord?.tag ?? "");
  const [meaning, setMeaning] = useState(initialWord?.meaning ?? "");
  const [synonyms, setSynonyms] = useState(initialWord?.synonyms.join(", ") ?? "");
  const [antonyms, setAntonyms] = useState(initialWord?.antonyms.join(", ") ?? "");
  const [example, setExample] = useState(initialWord?.example ?? "");
  const [inASentence, setInASentence] = useState(initialWord?.inASentence ?? "");
  const [imageUrl, setImageUrl] = useState(initialWord?.imageUrl ?? "");
  const [imageCaption, setImageCaption] = useState(initialWord?.imageCaption ?? "");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setFieldErrors({});
    const payload: WordInput = {
      word,
      tag: tag || null,
      meaning,
      synonyms: synonyms.split(",").map((item) => item.trim()).filter(Boolean),
      antonyms: antonyms.split(",").map((item) => item.trim()).filter(Boolean),
      example,
      in_a_sentence: inASentence,
      image_url: imageUrl.trim() || null,
      image_caption: imageCaption.trim() || null,
    };
    try {
      const response = await fetch(
        initialWord ? `/api/words/${initialWord.id}` : "/api/words/manual",
        {
          method: initialWord ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json()) as {
        error?: string;
        details?: Array<{ field: string; message: string }>;
      };
      if (!response.ok) {
        setError(result.error ?? "The word could not be saved.");
        setFieldErrors(
          Object.fromEntries((result.details ?? []).map(({ field, message }) => [field, message])),
        );
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Could not reach the server. Your entries are still here; try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      <label>
        Word
        <input required maxLength={200} value={word} onChange={(event) => setWord(event.target.value)} />
        {fieldErrors.word && <span className="field-error">{fieldErrors.word}</span>}
      </label>
      <label>
        Tag <span className="label-hint">optional part of speech</span>
        <select
          value={tag}
          onChange={(event) => setTag(event.target.value as WordTag | "")}
        >
          <option value="">None</option>
          {WORD_TAGS.map((option) => (
            <option key={option} value={option}>
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </option>
          ))}
        </select>
        {fieldErrors.tag && <span className="field-error">{fieldErrors.tag}</span>}
      </label>
      <label>
        Meaning
        <textarea required maxLength={2000} rows={3} value={meaning} onChange={(event) => setMeaning(event.target.value)} />
        {fieldErrors.meaning && <span className="field-error">{fieldErrors.meaning}</span>}
      </label>
      <label>
        Synonyms <span className="label-hint">comma-separated</span>
        <input value={synonyms} onChange={(event) => setSynonyms(event.target.value)} />
        {fieldErrors.synonyms && <span className="field-error">{fieldErrors.synonyms}</span>}
      </label>
      <label>
        Antonyms <span className="label-hint">comma-separated</span>
        <input value={antonyms} onChange={(event) => setAntonyms(event.target.value)} />
        {fieldErrors.antonyms && <span className="field-error">{fieldErrors.antonyms}</span>}
      </label>
      <label>
        Example
        <textarea required maxLength={2000} rows={2} value={example} onChange={(event) => setExample(event.target.value)} />
        {fieldErrors.example && <span className="field-error">{fieldErrors.example}</span>}
      </label>
      <label>
        In a sentence
        <textarea required maxLength={2000} rows={2} value={inASentence} onChange={(event) => setInASentence(event.target.value)} />
        {fieldErrors.in_a_sentence && <span className="field-error">{fieldErrors.in_a_sentence}</span>}
      </label>
      <label>
        Image URL <span className="label-hint">optional, HTTPS only</span>
        <input type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} />
        {fieldErrors.image_url && <span className="field-error">{fieldErrors.image_url}</span>}
      </label>
      <label>
        Image caption <span className="label-hint">optional</span>
        <input maxLength={500} value={imageCaption} onChange={(event) => setImageCaption(event.target.value)} />
      </label>
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="button-row">
        <button className="button button-primary" disabled={submitting}>
          {submitting ? "Saving..." : initialWord ? "Save changes" : "Add word"}
        </button>
        <button className="button button-quiet" type="button" onClick={() => router.back()}>
          Cancel
        </button>
      </div>
    </form>
  );
}
