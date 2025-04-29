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
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">進行中</span>;
      case 2:
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded">完了</span>;
      case 3:
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded">エラー</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded">不明</span>;
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

      navigate(0)
    } catch (error) {
      console.error("Error deleting research:", error);
    }
  }

  if (researches.length === 0) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-6">リサーチ一覧</h2>
        <p className="mb-4">リサーチがまだありません。</p>
        <Link to="/create" className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700">
          新しいリサーチを作成
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">リサーチ一覧</h2>
        <Link to="/create" className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700">
          新しいリサーチを作成
        </Link>
      </div>
      <div className="grid gap-4">
        {researches.map((research) => {
          return (
            <div key={research.id} className="border rounded p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold">
                  <Link to={`/details/${research.id}`} className="hover:underline">
                    {research.query}
                  </Link>
                </h3>
                {getStatusBadge(research.status)}
              </div>
              <div className="text-sm text-gray-500 mb-3">作成: {research.created_at ? timeAgo(research.created_at) : null}</div>
              <div className="flex space-x-2">
                <Link to={`/details/${research.id}`} className="text-blue-600 hover:underline">
                  詳細を見る
                </Link>
                <button onClick={() => handleDelete(research.id)} className="text-red-600 hover:underline">
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
