import type { Route } from "./+types/article.$id";
import { useState } from "react";
import { Link, useLoaderData } from "react-router";
import { eq } from "drizzle-orm";
import { researches, researchImages, researchSources } from "@/db/schema";
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

  let content = research.content || "記事を読み込めませんでした。。";

  const processedResearch = {
    ...research,
    content,
    images,
    urls: sources.map((source) => source.url),
  };

  return { research: processedResearch };
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
    <div className="m-2">
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
              className="px-2 py-1 bg-stone-300 hover:bg-stone-500 rounded-xl text-xs border border-stone-500 transition-colors"
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

  return (
    <div className="max-w-2xl p-2 mx-auto">
      <div className="flex text-xs">
        <div className="m-2">カテゴリー: {research.category || "不明"}</div>
        <div className="text-stone-500 m-2">作成: {research.created_at ? timeAgo(research.created_at) : null}</div>
      </div>
      <MarkdownRenderer markdown={research.content} images={research.images} />
      <DomainList urls={research.urls} />
    </div>
  );
}
