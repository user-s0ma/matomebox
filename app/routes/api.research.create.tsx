import type { Route } from "./+types/api.research.create";
import { getDrizzleClient } from "@/lib/db";
import { researches } from "@/db/schema";

export async function action({ request, context }: Route.LoaderArgs) {
  const { query, depth, breadth, questions, answers } = (await request.json()) as any;
  const user = "unknown";

  const processedQuestions = questions.map((question: string, i: number) => ({
    question,
    answer: answers[i] || "",
  }));

  const db = getDrizzleClient();

  const [research] = await db
    .insert(researches)
    .values({
      query,
      depth,
      breadth,
      questions: JSON.stringify(processedQuestions),
      status: 0,
      user,
    })
    .$returningId();

  try {
    const id = crypto.randomUUID();

    await context.cloudflare.env.RESEARCH_WORKFLOW.create({
      id,
      params: {
        id: research.id,
        query,
        depth,
        breadth,
        questions: processedQuestions,
      },
    });
  } catch (error) {
    console.error("Failed to start research workflow:", error);
  }
  return new Response(JSON.stringify({ success: true, id: research.id }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
