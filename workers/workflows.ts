import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { researches } from "@/db/schema";
import { getDrizzleClient } from "@/lib/db";
import { model } from "@/lib/gemini";
import { getBrowser, webSearch } from "@/lib/webSearch";
import { DEEP_SEARCH_QUERIES_PROMPT, DEEP_PROCESS_RESULTS_PROMPT, DEEP_FINAL_REPORT_PROMPT } from "@/lib/prompts";
import { ImageProcessor } from "@/lib/imageProcessor";

interface ResearchParams {
  id: string;
  query: string;
  depth: string;
  breadth: string;
  questions: Array<{ question: string; answer: string }>;
}

export class ResearchWorkflow extends WorkflowEntrypoint<Env, ResearchParams> {
  async run(event: WorkflowEvent<ResearchParams>, step: WorkflowStep) {
    console.log("ワークフロー開始");
    try {
      const db = getDrizzleClient();
      const browser = await getBrowser();

      const { id } = event.payload;

      let allImages: any[] = [];

      try {
        const { query, depth, breadth } = event.payload;

        await db.update(researches).set({ status: 1 }).where(eq(researches.id, id));

        const serpQueries = await step.do(
          "[generate-search-queries]",
          {
            retries: {
              limit: 1,
              delay: "10 seconds",
              backoff: "exponential",
            },
            timeout: "10 minutes",
          },
          async () => {
            return await this.generateSerpQueries(query, parseInt(breadth));
          }
        );

        let allLearnings: string[] = [];
        let allUrls: string[] = [];

        for (const serpQuery of serpQueries) {
          try {
            const browserInstance = await browser.getActiveBrowser();

            const result = await step.do(
              `[search]-${serpQuery.query.substring(0, 20).replace(/\s+/g, "-")}`,
              {
                retries: {
                  limit: 1,
                  delay: "10 seconds",
                  backoff: "exponential",
                },
                timeout: "10 minutes",
              },
              async () => {
                return await webSearch(browserInstance, serpQuery.query, 5);
              }
            );

            const { learnings, followUpQuestions, processedImages } = await step.do(
              `[process-results]-${serpQuery.query.substring(0, 20).replace(/\s+/g, "-")}`,
              {
                retries: {
                  limit: 1,
                  delay: "10 seconds",
                  backoff: "exponential",
                },
                timeout: "10 minutes",
              },
              async () => {
                return await this.processSerpResult(serpQuery.query, result, Math.ceil(parseInt(breadth) / 2));
              }
            );

            allLearnings = [...allLearnings, ...learnings];
            allUrls = [...allUrls, ...result.map((item) => item.url).filter(Boolean)];

            if (processedImages && processedImages.length > 0) {
              const selectedImages = processedImages.slice(0, 10 - allImages.length);
              allImages = [...allImages, ...selectedImages];
            }

            await db
              .update(researches)
              .set({
                interim_results: JSON.stringify({
                  learnings: allLearnings,
                  urls: allUrls,
                  images: allImages,
                  progress: (allLearnings.length / (parseInt(breadth) * 5)) * 100,
                }),
              })
              .where(eq(researches.id, id));

            if (parseInt(depth) > 1) {
              const nextQueries = await step.do(
                `[generate-followup-queries]-${serpQuery.query.substring(0, 15).replace(/\s+/g, "-")}`,
                {
                  retries: {
                    limit: 1,
                    delay: "10 seconds",
                    backoff: "exponential",
                  },
                  timeout: "10 minutes",
                },
                async () => {
                  return await this.generateSerpQueries(followUpQuestions.join("\n"), Math.ceil(parseInt(breadth) / 2), allLearnings);
                }
              );

              for (const nextQuery of nextQueries) {
                const nextResult = await step.do(
                  `[deep-search]-${nextQuery.query.substring(0, 15).replace(/\s+/g, "-")}`,
                  {
                    retries: {
                      limit: 1,
                      delay: "10 seconds",
                      backoff: "exponential",
                    },
                    timeout: "10 minutes",
                  },
                  async () => {
                    return await webSearch(browserInstance, nextQuery.query, 3);
                  }
                );

                const nextProcessResult = await step.do(
                  `[deep-process]-${nextQuery.query.substring(0, 15).replace(/\s+/g, "-")}`,
                  {
                    retries: {
                      limit: 1,
                      delay: "10 seconds",
                      backoff: "exponential",
                    },
                    timeout: "10 minutes",
                  },
                  async () => {
                    return await this.processSerpResult(nextQuery.query, nextResult);
                  }
                );

                allLearnings = [...allLearnings, ...nextProcessResult.learnings];
                allUrls = [...allUrls, ...nextResult.map((item) => item.url).filter(Boolean)];

                if (nextProcessResult.processedImages && nextProcessResult.processedImages.length > 0) {
                  const remainingSlots = 10 - allImages.length;
                  if (remainingSlots > 0) {
                    const selectedDeepImages = nextProcessResult.processedImages.slice(0, remainingSlots);
                    allImages = [...allImages, ...selectedDeepImages];
                  }
                }
              }
            }
          } catch (error) {
            console.error(`クエリ処理エラー: ${serpQuery.query}`, error);
          }
        }

        const report = await step.do(
          "[write-final-report]",
          {
            retries: {
              limit: 1,
              delay: "10 seconds",
              backoff: "exponential",
            },
            timeout: "10 minutes",
          },
          async () => {
            return await this.writeFinalReport(query, allLearnings, allUrls, allImages);
          }
        );

        await db
          .update(researches)
          .set({
            result: report,
            status: 2,
            images: JSON.stringify(allImages),
          })
          .where(eq(researches.id, id));

        return { success: true, learningsCount: allLearnings.length, imagesCount: allImages.length };
      } catch (error) {
        console.error("リサーチプロセス失敗:", error);

        await db
          .update(researches)
          .set({
            status: 3,
            result: `エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
          })
          .where(eq(researches.id, id));

        return { success: false, error: String(error) };
      } finally {
        await browser.close();
      }
    } catch (error) {
      console.error("ワークフロー失敗", error);
      return { success: false, error: String(error) };
    }
  }

  async generateSerpQueries(query: string, numQueries: number = 5, learnings?: string[]) {
    console.log(`📄 検索クエリ生成開始`);

    const { response } = await model.generateContent([
      DEEP_SEARCH_QUERIES_PROMPT() +
        `\n\n以下のテーマに関する検索クエリを${numQueries}個生成してください：\n${query}${learnings ? `\n\n参考情報：\n${learnings.join("\n")}` : ""}`,
    ]);
    const content = response.text();

    console.log(`📄 検索クエリ生成完了: ${content.substring(0, 100)}${content.length > 100 ? "..." : ""}`);
    const lines = content.split("\n").filter((line) => line.trim() !== "");
    const queries = lines
      .map((line) => {
        const query = line.replace(/^\d+\.\s*/, "").trim();
        return {
          query: query,
          researchGoal: "Gather information related to the main query",
        };
      })
      .slice(0, numQueries);
    return queries;
  }

  async processSerpResult(query: string, result: any[], numFollowUpQuestions: number = 5, numLearnings: number = 5) {
    console.log(`検索結果処理: ${query}`);

    const processedResults = await Promise.all(
      result.map(async (item) => {
        if (!item.markdown || !item.images || item.images.length === 0) {
          return { enhancedMarkdown: item.markdown || "", analyzedImages: [] };
        }

        const imageProcessor = new ImageProcessor();
        const analyzedImages = await imageProcessor.analyzeAllImages(item.images);

        let enhancedMarkdown = item.markdown;

        for (const img of analyzedImages) {
          if (img.analysis) {
            const placeholder = `[IMAGE_PLACEHOLDER_${img.id}]`;
            const replacement = `\n\n[IMAGE_CONTEXT: ${img.analysis}]\n\n[IMAGE_TAG_${img.id}]\n\n`;

            enhancedMarkdown = enhancedMarkdown.replace(placeholder, replacement);
          }
        }

        return { enhancedMarkdown, analyzedImages };
      })
    );

    const processedImages = processedResults.flatMap((result) => result.analyzedImages).filter((img) => img.analysis);
    const contentsWithImages = processedResults.map((result) => result.enhancedMarkdown);

    if (contentsWithImages.length === 0) {
      console.warn(`検索クエリ「${query}」の結果が空です`);
      return {
        learnings: ["検索結果が見つかりませんでした。"],
        followUpQuestions: ["他のキーワードで検索すべきですか？"],
        processedImages: [],
      };
    }

    console.log(`📄 検索結果処理開始`);

    const { response } = await model.generateContent([
      DEEP_PROCESS_RESULTS_PROMPT() + `以下の検索結果を分析してください：\n\n検索クエリ: ${query}\n\n検索結果:${contentsWithImages.join("\n\n---\n\n")}`,
    ]);
    const content = response.text();

    console.log(`📄 検索結果処理完了: ${content.substring(0, 100)}${content.length > 100 ? "..." : ""}`);

    const sections = content.split(/#+\s*Follow-up Questions/i);

    let learnings: string[] = [];
    if (sections.length > 0) {
      learnings = sections[0]
        .split(/\d+\.\s+/)
        .slice(1)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, numLearnings);
    }

    let followUpQuestions: string[] = [];
    if (sections.length > 1) {
      followUpQuestions = sections[1]
        .split(/\d+\.\s+/)
        .slice(1)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, numFollowUpQuestions);
    }

    return { learnings, followUpQuestions, processedImages };
  }

  async generateArticleDraft(prompt: string, learnings: string[]): Promise<string> {
    console.log(`📝 記事ドラフト生成開始: ${prompt}`);

    const draftPrompt = `
      あなたはプロのニュース記者です。以下の情報に基づいて「${prompt}」に関する記事の下書きを作成してください。
      
      【指示】
      1. 「である・だ」調の報道文体を使用してください
      2. 事実と具体的な数字を重視してください
      3. 段落ごとに明確なトピックを設定してください
      4. 各段落は独立して理解できるようにしてください
      
      【収集情報】
      ${learnings.map((learning, index) => `${index + 1}. ${learning}`).join("\n")}
      `;

    try {
      const { response } = await model.generateContent([draftPrompt]);
      const draft = response.text();

      console.log(`📝 記事ドラフト生成完了: ${draft.substring(0, 100)}${draft.length > 100 ? "..." : ""}`);
      return draft;
    } catch (error) {
      console.error("記事ドラフト生成エラー:", error);
      return learnings.join("\n\n");
    }
  }

  async writeFinalReport(prompt: string, learnings: string[], visitedUrls: string[], images: any[] = []) {
    try {
      const articleDraft = await this.generateArticleDraft(prompt, learnings);

      const imageProcessor = new ImageProcessor();
      const finalArticle = await imageProcessor.processArticleWithImages(articleDraft, images);

      const urlsSection = `\n\n## 参考サイト\n\n${visitedUrls.map((url) => `- ${url}`).join("\n")}`;
      return finalArticle// + urlsSection;
    } catch (error) {
      console.error("最終レポート生成エラー:", error);

      const { response } = await model.generateContent([
        DEEP_FINAL_REPORT_PROMPT() +
          `プロンプト「${prompt}」を使用して、収集した情報に基づいて記事を作成してください。\n\n` +
          `${learnings.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
      ]);

      const basicReport = response.text();
      const urlsSection = `\n\n## 参考サイト\n\n${visitedUrls.map((url) => `- ${url}`).join("\n")}`;

      return basicReport// + urlsSection;
    }
  }
}
