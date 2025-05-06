import type { Route } from "./+types/create";
import { getDrizzleClient } from "@/lib/db";
import { researches } from "@/db/schema";
import { and, gt } from "drizzle-orm";

const RATE_LIMIT = {
  MAX_REQUESTS: 5, // 5リクエスト
  WINDOW_MS: 30 * 60 * 1000, // 30分間
};

const VALIDATION = {
  MAX_QUERY_LENGTH: 50, // クエリ最大長：50文字
  MIN_DEPTH_BREADTH: 1, // 最小深さ・幅：1
  MAX_DEPTH_BREADTH: 5, // 最大深さ・幅：5
};

export async function action({ request, context }: Route.ActionArgs) {
  const { query, depth, breadth } = (await request.json()) as any;

  const queryFormat = query.replace("\n", " ");
  const depthNumber = parseInt(depth, 10);
  const breadthNumber = parseInt(breadth, 10);

  if (!queryFormat.trim() || typeof queryFormat !== "string" || queryFormat.length > VALIDATION.MAX_QUERY_LENGTH) {
    return new Response(JSON.stringify({ success: false, error: "クエリは必須で、50文字以下である必要があります。" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (
    isNaN(depthNumber) ||
    isNaN(breadthNumber) ||
    depthNumber < VALIDATION.MIN_DEPTH_BREADTH ||
    depthNumber > VALIDATION.MAX_DEPTH_BREADTH ||
    breadthNumber < VALIDATION.MIN_DEPTH_BREADTH ||
    breadthNumber > VALIDATION.MAX_DEPTH_BREADTH
  ) {
    return new Response(JSON.stringify({ success: false, error: "深さと幅は1から5の整数である必要があります。" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getDrizzleClient();

  const thirtyMinutesAgo = new Date(Date.now() - RATE_LIMIT.WINDOW_MS);

  const recentResearches = await db
    .select()
    .from(researches)
    .where(and(gt(researches.created_at, thirtyMinutesAgo)));

  const count = recentResearches.length;

  if (count >= RATE_LIMIT.MAX_REQUESTS) {
    return new Response(JSON.stringify({ success: false, error: "レート制限を超えました。しばらく経ってから再試行してください。" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const [research] = await db
      .insert(researches)
      .values({
        query: queryFormat,
        depth: depthNumber,
        breadth: breadthNumber,
        status: 0,
      })
      .$returningId();

    const id = crypto.randomUUID();

    await context.cloudflare.env.RESEARCH_WORKFLOW.create({
      id,
      params: {
        id: research.id,
        query: queryFormat,
        depth: depthNumber,
        breadth: breadthNumber,
      },
    });

    return new Response(JSON.stringify({ success: true, id: research.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("リサーチワークフローの開始に失敗しました:", error);

    return new Response(JSON.stringify({ success: false, error: "内部サーバーエラーが発生しました。" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
