import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Topbar } from "@/components/topbar";
import { WordForm } from "@/components/word-form";
import { isOwnerSignedIn } from "@/lib/auth";
import { getWord, listDueWords } from "@/lib/words";

type Props = { params: Promise<{ id: string }> };

export default async function EditWordPage({ params }: Props) {
  if (!(await isOwnerSignedIn())) redirect("/login");
  const { id } = await params;
  const [word, dueWords] = await Promise.all([getWord(id), listDueWords()]);
  if (!word) notFound();

  return (
    <main className="app-shell">
      <Topbar active="words" dueCount={dueWords.length} />
      <div className="narrow-content">
        <Link className="back-link" href="/">← Back to words</Link>
        <div className="page-heading">
          <p className="eyebrow">Your collection</p>
          <h1>Edit {word.word}</h1>
          <p className="muted">Editing a word will not reset its review schedule.</p>
        </div>
        <section className="panel form-panel">
          <WordForm initialWord={{
            id: word.id,
            word: word.word,
            tag: word.tag,
            meaning: word.meaning,
            synonyms: word.synonyms,
            antonyms: word.antonyms,
            example: word.example,
            inASentence: word.inASentence,
            imageUrl: word.imageUrl,
            imageCaption: word.imageCaption,
          }} />
        </section>
      </div>
    </main>
  );
}
