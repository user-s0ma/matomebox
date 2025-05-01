import type { Route } from "./+types/create";
import { useState } from "react";
import { useNavigate, useLoaderData } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query");
  const depth = parseInt(url.searchParams.get("depth") || "2", 10);
  const breadth = parseInt(url.searchParams.get("breadth") || "3", 10);

  let results: { research: { query: string; depth: number; breadth: number } } | null = null;
  if (query) {
    results = {
      research: { query, depth: depth || 2, breadth: breadth || 3 },
    };
  }

  return { results };
}

export default function CreatePage() {
  const { results } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

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
        const data: any = await response.json();
        let errorMessage = "リサーチの作成に失敗しました";
        if (data && data.error) {
          errorMessage = data.error;
        } else if (response.status === 429) {
          errorMessage = "レート制限を超えました。しばらく待ってから再試行してください。";
        }
        throw new Error(errorMessage);
      }

      navigate("/dash");
    } catch (error) {
      console.error("Error creating research:", error);
      setError(error instanceof Error ? error.message : "リサーチの作成に失敗しました");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl p-2 mx-auto">
      <h2 className="text-2xl font-bold mb-2">新しいリサーチの作成</h2>
      <form onSubmit={handleSubmit} className="">
        <div className="relative bg-stone-700 border border-stone-500 rounded-xl overflow-hidden">
          <textarea
            id="query"
            name="query"
            rows={4}
            className="w-full p-2 pb-12 resize-none"
            placeholder="リサーチしたいトピックの単語を入力してください"
            defaultValue={results?.research.query || ""}
            maxLength={50}
            required
          />
          <div className="absolute bottom-0 left-0 right-0 p-2 flex justify-between items-center rounded-b-xl">
            <div className="flex gap-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs">深さ:</span>
                <select
                  id="depth"
                  name="depth"
                  className="text-xs py-2 px-3 bg-stone-700 border border-stone-500 rounded-xl"
                  defaultValue={results?.research.depth.toString() || "2"}
                >
                  <option value="1">浅い (非推奨)</option>
                  <option value="2">中程度</option>
                  <option value="3">深い (遅い)</option>
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs">トピック</span>
                <select
                  id="breadth"
                  name="breadth"
                  className="text-xs py-2 px-3 bg-stone-700 border border-stone-500 rounded-xl"
                  defaultValue={results?.research.breadth.toString() || "3"}
                >
                  <option value="1">少しの</option>
                  <option value="3">中程度</option>
                  <option value="5">多くの</option>
                </select>
              </div>
            </div>
            <button type="submit" className="text-xs bg-amber-800 py-2 px-3 rounded-xl disabled:opacity-50" disabled={isSubmitting}>
              {isSubmitting ? "処理..." : "作成"}
            </button>
          </div>
        </div>
        {error && <div className="mt-4 p-3 bg-red-500 bg-opacity-25 border border-red-700 rounded-xl text-red-100 text-sm">{error}</div>}
      </form>
    </div>
  );
}
