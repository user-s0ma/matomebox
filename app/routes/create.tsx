import type { Route } from "./+types/create";
import { useState } from "react";
import { useNavigate } from "react-router";
import { DEEP_FOLLOWUP_QUESTIONS_PROMPT } from "@/lib/prompts";

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query");
  const depth = url.searchParams.get("depth") || "2";
  const breadth = url.searchParams.get("breadth") || "3";

  let results: { research: { query: string; depth: string; breadth: string }; questions: string[] } | null = null;
  if (query) {
    try {
      const messages = [
        { role: "system", content: DEEP_FOLLOWUP_QUESTIONS_PROMPT() },
        { 
          role: "user", 
          content: `以下の研究トピックについて、理解を深めるための3つのフォローアップ質問を提案してください：${query}`
        },
      ];

      const response = await context.cloudflare.env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", { messages, stream: false });

      let questions: string[] = [];
      try {
        // @ts-ignore
        const content: string = response.response;
        const lines = content.split("\n");
        questions = lines
          .filter((line) => /[?？]$/.test(line.trim()))
          .slice(0, 5)
          .map((line) => line.trim());
      } catch (error) {
        console.error("質問の抽出に失敗しました:", error);
        questions = ["情報が十分ですか？", "どのような結果を期待していますか？", "この研究の期限はありますか？"];
      }

      results = {
        research: { query, depth: depth || "2", breadth: breadth || "3" },
        questions,
      };
    } catch (error) {
      console.error("Error generating questions:", error);
    }
  }

  return { results };
}

export default function CreatePage({ loaderData }: Route.ComponentProps) {
  const { results } = loaderData;
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">新しいリサーチの作成</h2>
      <form method="get">
        <div className="mb-4">
          <label htmlFor="query" className="block text-sm font-medium mb-1">
            リサーチクエリ
          </label>
          <textarea
            id="query"
            name="query"
            rows={4}
            className="w-full p-2 border rounded"
            placeholder="リサーチしたいトピックや質問を入力してください"
            defaultValue={results?.research.query || ""}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor="depth" className="block text-sm font-medium mb-1">
              深さ
            </label>
            <select id="depth" name="depth" className="w-full p-2 border rounded" defaultValue={results?.research.depth || "2"}>
              <option value="1">浅い (速い)</option>
              <option value="2">中程度</option>
              <option value="3">深い (遅い)</option>
            </select>
          </div>
          <div>
            <label htmlFor="breadth" className="block text-sm font-medium mb-1">
              幅
            </label>
            <select id="breadth" name="breadth" className="w-full p-2 border rounded" defaultValue={results?.research.breadth || "3"}>
              <option value="1">狭い (1-2 トピック)</option>
              <option value="3">中程度 (3-5 トピック)</option>
              <option value="5">広い (多くのトピック)</option>
            </select>
          </div>
        </div>
        <button type="submit" className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700">
          続行
        </button>
      </form>
      {results && (
        <div className="mt-8">
          <NewResearchQuestions research={results.research} questions={results.questions} />
        </div>
      )}
    </div>
  );
}
function NewResearchQuestions({
  research,
  questions,
}: {
  research: {
    query: string;
    depth: string;
    breadth: string;
  };
  questions: string[];
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const questionElements = form.querySelectorAll('input[name="question"]');
    const questions = Array.from(questionElements).map((el) => (el as HTMLInputElement).value);

    const answerElements = form.querySelectorAll('textarea[name="answer"]');
    const answers = Array.from(answerElements).map((el) => (el as HTMLTextAreaElement).value);

    try {
      const response = await fetch("/api/research/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: formData.get("query"),
          depth: formData.get("depth"),
          breadth: formData.get("breadth"),
          questions,
          answers,
        }),
      });

      if (!response.ok) {
        throw new Error("リサーチの作成に失敗しました");
      }

      navigate("/");
    } catch (error) {
      console.error("Error creating research:", error);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">リサーチの詳細</h2>
      <form onSubmit={handleSubmit}>
        <input type="hidden" name="query" value={research.query} />
        <input type="hidden" name="depth" value={research.depth} />
        <input type="hidden" name="breadth" value={research.breadth} />
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">リサーチクエリ</h3>
          <div className="p-3 bg-gray-100 rounded">{research.query}</div>
        </div>
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">フォローアップ質問</h3>
          <p className="text-sm text-gray-600 mb-4">以下の質問に答えて、リサーチの方向性を明確にしてください</p>
          {questions.map((question, index) => (
            <div key={index} className="mb-4">
              <input type="hidden" name="question" value={question} />
              <label className="block font-medium mb-1">{question}</label>
              <textarea name="answer" rows={2} className="w-full p-2 border rounded" placeholder="あなたの回答" required />
            </div>
          ))}
        </div>
        <button type="submit" className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700" disabled={isSubmitting}>
          {isSubmitting ? "処理中..." : "リサーチを開始"}
        </button>
      </form>
    </div>
  );
}
