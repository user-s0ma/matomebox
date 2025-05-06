import type { Route } from "./+types/research.$id";
import { useState } from "react";
import { useNavigate, Link, useLoaderData } from "react-router";
import { ChevronLeft, LoaderCircle, CircleCheck } from "lucide-react";
import { eq } from "drizzle-orm";
import { researches, researchImages, researchSources, researchProgress, type ResearchProgress } from "@/db/schema";
import { getDrizzleClient } from "@/lib/db";
import { timeAgo } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

export async function loader({ params }: Route.LoaderArgs) {
  const { id } = params;

  const db = getDrizzleClient();

  const research = await db.query.researches.findFirst({
    where: eq(researches.id, id),
  });

  if (!research) {
    throw new Response("研究が見つかりません", { status: 404 });
  }

  const images = await db.query.researchImages.findMany({
    where: eq(researchImages.research_id, id),
  });

  const sources = await db.query.researchSources.findMany({
    where: eq(researchSources.research_id, id),
  });

  const latestProgress = await db.query.researchProgress.findFirst({
    where: eq(researchProgress.research_id, id),
    orderBy: (progress, { desc }) => [desc(progress.created_at)],
  });

  const progressHistory = await db.query.researchProgress.findMany({
    where: eq(researchProgress.research_id, id),
    orderBy: (progress, { asc }) => [asc(progress.created_at)],
  });

  let content = research.content || "レポートは実行中です...";

  const processedResearch = {
    ...research,
    content,
    images,
    urls: sources.map((source) => source.url),
    progress: latestProgress ? latestProgress.progress_percentage : null,
    status_message: latestProgress ? latestProgress.status_message : null,
    progressHistory,
  };

  return { research: processedResearch };
}

function ProgressDetails({ progressHistory, status }: { progressHistory: ResearchProgress[]; status: number }) {
  const [isOpen, setIsOpen] = useState(status === 1);

  if (!progressHistory || progressHistory.length === 0) {
    return null;
  }

  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 text-amber-700">
        <h3>{isOpen ? "ステップを閉じる" : "ステップを開く"}</h3>
      </button>
      {isOpen && (
        <div className="border border-stone-500 p-2 rounded-xl">
          <ul className="space-y-2">
            {progressHistory.map((item, index) => (
              <li key={index} className="border-b border-stone-500 pb-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-500">{item.created_at?.toLocaleString("ja-JP")}</span>
                </div>
                <div className="mt-1">{item.status_message}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DomainList({ urls }: { urls: string[] }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!urls || urls.length === 0) {
    return null;
  }

  const extractDomain = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (e) {
      console.error("無効なURL:", url);
      return url;
    }
  };

  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 text-amber-700">
        <h3>参考リンク ({urls.length}件)</h3>
      </button>
      {isOpen && (
        <div className="rounded-xl flex flex-wrap gap-2 mt-4">
          {urls.map((url: string, index: number) => (
            <Link
              key={index}
              to={url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 bg-stone-200 hover:bg-stone-500 rounded-xl text-xs border border-stone-500 transition-colors"
            >
              {extractDomain(url)}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ResearchDetails() {
  const { research } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

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
    <main className="flex-1">
      <div className="max-w-2xl p-2 mx-auto">
        <div className="mb-2">
          <Link to="/" className="text-amber-700 flex items-center">
            <ChevronLeft size={20} />
            リストに戻る
          </Link>
        </div>
        <h2 className="text-2xl font-bold wrap-anywhere">{research.query}</h2>
        <div className="flex text-xs space-x-2">
          <div className="">カテゴリー: {research.category || "不明"}</div>
          <div className="text-stone-500">作成: {research.created_at ? timeAgo(research.created_at) : null}</div>
        </div>
        <ProgressDetails progressHistory={research.progressHistory} status={research.status} />
        <div className="flex flex-col">
          {research.status === 1 ? (
            <div className="p-4 border border-stone-500 rounded-xl flex items-center">
              <div className="animate-spin mr-4">
                <LoaderCircle size={20} />
              </div>
              <div className="w-full bg-white h-2 rounded-full">
                <div
                  className="bg-amber-700 h-2 rounded-full transition-all duration-500 ease-in-out"
                  style={{ width: `${Math.min(research.progress || 0, 100)}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <div className="border border-stone-500 rounded-xl p-4">
              <MarkdownRenderer markdown={research.content} images={research.images} />
              <DomainList urls={research.urls} />
            </div>
          )}
        </div>
        <div className="flex space-x-2">
          <button onClick={() => handleDelete(research.id)} className="text-red-500">
            削除
          </button>
        </div>
      </div>
    </main>
  );
}
