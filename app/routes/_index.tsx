import type { Route } from "./+types/_index";
import { Link } from "react-router";
import { desc } from "drizzle-orm";
import { researches } from "@/db/schema";
import { getDrizzleClient } from "@/lib/db";
import { timeAgo } from "@/lib/utils";
import { useNavigate } from "react-router";

export async function loader() {
  const db = getDrizzleClient();

  const researchResults = await db.query.researches.findMany({
    orderBy: [desc(researches.created_at)],
  });

  return { researches: researchResults };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { researches } = loaderData;
  const navigate = useNavigate();

  function getStatusBadge(status: number) {
    switch (status) {
      case 1:
        return <span className="px-2 py-1 bg-amber-900 bg-opacity-30 text-amber-300 border border-amber-700 text-xs rounded-xl">進行中</span>;
      case 2:
        return <span className="px-2 py-1 bg-emerald-900 bg-opacity-30 text-emerald-300 border border-emerald-700 text-xs rounded-xl">完了</span>;
      case 3:
        return <span className="px-2 py-1 bg-red-900 bg-opacity-30 text-red-300 border border-red-700 text-xs rounded-xl">エラー</span>;
      default:
        return <span className="px-2 py-1 bg-stone-800 bg-opacity-30 text-stone-300 border border-stone-600 text-xs rounded-xl">不明</span>;
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("このリサーチを削除してもよろしいですか？")) {
      return;
    }

    try {
      const response = await fetch("/api/research/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        throw new Error("リサーチの削除に失敗しました");
      }

      navigate(0);
    } catch (error) {
      console.error("Error deleting research:", error);
    }
  }

  if (researches.length === 0) {
    return (
      <div className="p-2 text-center">
        <h2 className="text-2xl font-bold mb-6">記事一覧</h2>
        <p className="mb-4">記事がまだありません。</p>
        <Link to="/create" className="bg-amber-800 py-2 px-4 rounded-xl">
          新しい記事を作成
        </Link>
      </div>
    );
  }

  return (
    <div className="p-2">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">記事一覧</h2>
        <Link to="/create" className="bg-amber-800 py-2 px-4 rounded-xl">
          新しい記事を作成
        </Link>
      </div>
      <div className="grid gap-4">
        {researches.map((research) => {
          return (
            <div key={research.id} className="border border-stone-500 rounded-xl p-4 bg-stone-800">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-xl font-bold">
                  <Link to={`/details/${research.id}`}>
                    {research.query}
                  </Link>
                </h3>
                {getStatusBadge(research.status)}
              </div>
              <div className="text-sm text-stone-500 mb-3">作成: {research.created_at ? timeAgo(research.created_at) : null}</div>
              <div className="flex space-x-2">
                <button onClick={() => handleDelete(research.id)} className="text-red-500 text-xs">
                  削除
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
