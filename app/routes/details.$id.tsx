import type { Route } from "./+types/details.$id";
import { useNavigate, Link } from "react-router";
import { eq } from "drizzle-orm";
import { researches } from "@/db/schema";
import { getDrizzleClient } from "@/lib/db";
import { timeAgo } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

export async function loader({ params }: { params: { id: string } }) {
  const { id } = params;

  const db = getDrizzleClient();

  const research = await db.query.researches.findFirst({
    where: eq(researches.id, id),
  });

  if (!research) {
    throw new Response("研究が見つかりません", { status: 404 });
  }

  let images = [];
  try {
    if (research.images) {
      images = JSON.parse(research.images as unknown as string);
    }
  } catch (e) {
    console.error("画像データのパースに失敗しました:", e);
  }

  let content = (research.result || "レポートは実行中です...").replaceAll("```markdown", "").replaceAll("```", "");

  const processedResearch = {
    ...research,
    content: content,
    images: images,
  };

  return { research: processedResearch };
}

export default async function ResearchDetails({ loaderData }: Route.ComponentProps) {
  const { research } = loaderData;
  const navigate = useNavigate();

  function getStatusBadge(status: number) {
    switch (status) {
      case 1:
        return <span className="px-2 py-1 bg-amber-900 bg-opacity-30 text-amber-300 border border-amber-700 text-xs rounded">進行中</span>;
      case 2:
        return <span className="px-2 py-1 bg-emerald-900 bg-opacity-30 text-emerald-300 border border-emerald-700 text-xs rounded">完了</span>;
      case 3:
        return <span className="px-2 py-1 bg-red-900 bg-opacity-30 text-red-300 border border-red-700 text-xs rounded">エラー</span>;
      default:
        return <span className="px-2 py-1 bg-stone-800 bg-opacity-30 text-stone-300 border border-stone-600 text-xs rounded">不明</span>;
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

      navigate("/");
    } catch (error) {
      console.error("Error deleting research:", error);
    }
  }

  return (
    <div className="max-w-4xl p-2 mx-auto">
      <div className="mb-6">
        <Link to="/" className="text-amber-800 flex items-center text-xs">
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          リストに戻る
        </Link>
      </div>
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-2xl font-bold text-stone-100">{research.query}</h2>
        {getStatusBadge(research.status)}
      </div>
      <div className="text-xs text-stone-400 mb-6">作成: {research.created_at ? timeAgo(research.created_at) : null}</div>
      <div className="mb-6 bg-stone-750 border border-stone-500 rounded-xl p-4">
        <h3 className="text-xl font-bold mb-2">パラメータ</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-stone-300">深さ:</span> {research.depth}
          </div>
          <div>
            <span className="text-stone-300">幅:</span> {research.breadth}
          </div>
        </div>
      </div>
      <div className="mb-6">
        <h3 className="text-xl font-bold mb-2">リサーチレポート</h3>
        {research.status === 1 ? (
          <div className="p-4 bg-amber-800 opacity-50 rounded-xl flex items-center">
            <svg className="animate-spin h-5 w-5 mr-3 text-stone-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            リサーチは現在進行中です...
          </div>
        ) : (
          <div className="prose prose-stone prose-invert max-w-none bg-stone-750 border border-stone-500 rounded-xl p-4">
            <MarkdownRenderer markdown={research.content} images={research.images} />
          </div>
        )}
      </div>
      <div className="flex space-x-2">
        <button onClick={() => handleDelete(research.id)} className="text-red-500 text-xs">
          削除
        </button>
      </div>
    </div>
  );
}
