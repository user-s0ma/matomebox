import { useState } from "react";
import { Link, useLoaderData } from "react-router";
import { desc } from "drizzle-orm";
import { researches } from "@/db/schema";
import { getDrizzleClient } from "@/lib/db";
import { timeAgo } from "@/lib/utils";
import { useNavigate } from "react-router";

export async function loader() {
  const db = getDrizzleClient();

  const researchResults = await db.query.researches.findMany({
    orderBy: [desc(researches.created_at)],
    limit: 10
  });

  return { researches: researchResults };
}

export default function Home() {
  const { researches } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function getStatusBadge(status: number) {
    switch (status) {
      case 1:
        return <span className="px-2 py-1 bg-amber-700 bg-opacity-30 text-amber-300 border border-amber-300 text-xs rounded-xl">進行中</span>;
      case 2:
        return <span className="px-2 py-1 bg-emerald-700 bg-opacity-30 text-emerald-300 border border-emerald-300 text-xs rounded-xl">完了</span>;
      case 3:
        return <span className="px-2 py-1 bg-red-700 bg-opacity-30 text-red-300 border border-red-300 text-xs rounded-xl">エラー</span>;
      default:
        return <span className="px-2 py-1 bg-stone-700 bg-opacity-30 text-stone-300 border border-stone-300 text-xs rounded-xl">不明</span>;
    }
  }

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
          type: formData.get("type"),
        }),
      });
      const data: any = await response.json();

      if (!response.ok) {
        let errorMessage = "リサーチの作成に失敗しました";
        if (data && data.error) {
          errorMessage = data.error;
        } else if (response.status === 429) {
          errorMessage = "レート制限を超えました。しばらく待ってから再試行してください。";
        }
        throw new Error(errorMessage);
      }

      navigate(`/research/${data.id}`);
    } catch (error) {
      console.error("Error creating research:", error);
      setError(error instanceof Error ? error.message : "リサーチの作成に失敗しました");
      setIsSubmitting(false);
    }
  }

  return (
    <main
      className="flex-1 relative overflow-hidden"
      style={{
        backgroundImage: "radial-gradient(circle, #888 1px, transparent 1px)",
        backgroundSize: `25px 25px`,
      }}
    >
      <div className="absolute top-0 left-0 flex flex-col m-4">
        <div className="flex space-x-4 space-y-4">
          <div className="h-[10vh] w-[10vh] rounded-[25%] rounded-br-[100%] bg-blue-600"></div>
          <div className="h-[10vh] w-[10vh] rounded-full rounded-bl-none bg-red-400"></div>
          <div className="h-[10vh] w-[10vh] rounded-full rounded-b-none rounded-br-none bg-yellow-400"></div>
        </div>
        <div className="flex space-x-4 space-y-4">
          <div className="h-[10vh] w-[10vh] rounded-[25%] rounded-tl-none rounded-br-none bg-violet-400"></div>
          <div className="h-[10vh] w-[10vh] rounded-full bg-orange-400"></div>
        </div>
      </div>
      <div className="max-w-2xl p-2 mx-auto relative flex flex-col z-10">
        <h2 className="p-2 mx-auto mt-[30vh] text-2xl font-bold font-serif">こんにちは、今日はなにをしますか？</h2>
        <form onSubmit={handleSubmit} className="p-2 mb-[20vh]">
          <div className="relative bg-white border border-stone-500 rounded-xl overflow-hidden">
            <textarea
              id="query"
              name="query"
              rows={4}
              className="w-full h-full p-4 pb-12 relative resize-none"
              placeholder="リサーチしたいトピックの単語を入力してください"
              defaultValue={""}
              maxLength={50}
              required
            />
            <div className="absolute bottom-0 left-0 right-0 p-2 flex justify-between items-center rounded-b-xl">
              <div className="flex gap-2">
                <div className="flex items-center">
                  <span className="p-2 text-xs">深さ</span>
                  <select id="depth" name="depth" className="p-2 text-xs rounded-xl" defaultValue={"2"}>
                    <option value="1">浅い</option>
                    <option value="2">中程度</option>
                    <option value="3">深い</option>
                  </select>
                </div>
                <div className="flex items-center">
                  <span className="p-2 text-xs">広さ</span>
                  <select id="breadth" name="breadth" className="p-2 text-xs rounded-xl" defaultValue={"2"}>
                    <option value="1">少し</option>
                    <option value="2">中程度</option>
                    <option value="3">広く</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="text-white text-xs bg-black py-2 px-3 rounded-xl disabled:opacity-50" disabled={isSubmitting}>
                {isSubmitting ? "処理..." : "作成"}
              </button>
            </div>
          </div>
          {error && <div className="mt-4 p-3 bg-red-500 bg-opacity-25 rounded-xl text-white text-sm">{error}</div>}
        </form>
        <div className="p-2 grid grid-cols-2 gap-4">
          {researches.map((research) => {
            return (
              <Link
                to={`/research/${research.id}`}
                key={research.id}
                className="flex flex-col aspect-square bg-white border border-stone-500 rounded-xl overflow-hidden bg-cover bg-center"
                style={{ backgroundImage: `url(${research.thumbnail})` }}
              >
                <div className="shrink-0 m-2">{getStatusBadge(research.status)}</div>
                <h3 className="p-2 flex flex-col flex-1 justify-end text-white bg-linear-to-t from-black to-transparent">
                  <div className="font-bold wrap-anywhere line-clamp-2">{research.title || research.query}</div>
                  <div className="flex text-xs space-x-2">
                    <div className="">{research.category || "不明"}</div>
                    <div className="text-stone-500">{research.created_at ? timeAgo(research.created_at) : null}</div>
                  </div>
                </h3>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
