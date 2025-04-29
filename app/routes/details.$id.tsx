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

      navigate("/");
    } catch (error) {
      console.error("Error deleting research:", error);
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link to="/" className="text-blue-600 hover:underline">
          ← リスト戻る
        </Link>
      </div>
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-2xl font-bold">{research.query}</h2>
        {getStatusBadge(research.status)}
      </div>
      <div className="text-sm text-gray-500 mb-6">作成: {research.created_at ? timeAgo(research.created_at) : null}</div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">パラメータ</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="font-medium">深さ:</span> {research.depth}
          </div>
          <div>
            <span className="font-medium">幅:</span> {research.breadth}
          </div>
        </div>
      </div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">リサーチレポート</h3>
        {research.status === 1 ? (
          <div className="p-4 bg-yellow-50 rounded">リサーチは現在進行中です...</div>
        ) : (
          <div className="prose max-w-none">
            <MarkdownRenderer markdown={research.content} images={research.images} />
          </div>
        )}
      </div>
      <div className="flex space-x-4 mt-8">
        <button onClick={() => handleDelete(research.id)} className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700">
          削除
        </button>
      </div>
    </div>
  );
}
