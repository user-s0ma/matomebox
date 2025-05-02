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
  });

  return { researches: researchResults };
}

export default function Home() {
  const { researches } = useLoaderData<typeof loader>();
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
        <h2 className="text-2xl font-bold mb-2">リサーチ一覧</h2>
        <p className="mb-4">リサーチがまだありません。</p>
        <Link to="/create" className="bg-amber-700 py-2 px-4 rounded-xl">
          新しいリサーチを作成
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl p-2 mx-auto">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-bold">リサーチ一覧</h2>
        <Link to="/dash/create" className="bg-amber-700 py-2 px-4 rounded-xl">
          新しいリサーチを作成
        </Link>
      </div>
      <div className="grid gap-4">
        {researches.map((research) => {
          return (
            <div key={research.id} className="border border-stone-500 rounded-xl p-4 bg-stone-800">
              <div className="flex justify-between items-start m-2">
                <h3 className="text-xl font-bold">
                  <Link to={`/dash/details/${research.id}`} className="wrap-anywhere">
                    {research.title || research.query}
                  </Link>
                </h3>
                <div className="shrink-0">{getStatusBadge(research.status)}</div>
              </div>
              <div className="flex text-xs">
                <div className="m-2">カテゴリー: {research.category || "不明"}</div>
                <div className="text-stone-500 m-2">作成: {research.created_at ? timeAgo(research.created_at) : null}</div>
              </div>
              <button onClick={() => handleDelete(research.id)} className="text-red-500 text-xs m-2">
                削除
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
