import type { Route } from "./+types/create";
import { useState } from "react";
import { useNavigate } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query");
  const depth = url.searchParams.get("depth") || "2";
  const breadth = url.searchParams.get("breadth") || "3";

  let results: { research: { query: string; depth: string; breadth: string } } | null = null;
  if (query) {
    results = {
      research: { query, depth: depth || "2", breadth: breadth || "3" },
    };
  }

  return { results };
}

export default function CreatePage({ loaderData }: Route.ComponentProps) {
  const { results } = loaderData;
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

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
      <h2 className="text-2xl font-bold mb-6">新しいニュース記事の作成</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="query" className="block text-sm font-medium mb-1">
            リサーチクエリ
          </label>
          <textarea
            id="query"
            name="query"
            rows={4}
            className="w-full p-2 border rounded"
            placeholder="リサーチしたいトピックや単語を入力してください"
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
        <button type="submit" className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700" disabled={isSubmitting}>
          {isSubmitting ? "処理中..." : "ニュース記事を作成"}
        </button>
      </form>
    </div>
  );
}
