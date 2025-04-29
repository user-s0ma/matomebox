import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { researches } from "@/db/schema";
import { getDrizzleClient } from "@/lib/db";
import { getBrowser, webSearch } from "@/lib/webSearch";
import { DEEP_SEARCH_QUERIES_PROMPT, DEEP_PROCESS_RESULTS_PROMPT, DEEP_FINAL_REPORT_PROMPT } from "@/lib/prompts";

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

      let allImages = [];

      try {
        const { query, depth, breadth, questions } = event.payload;

        await db.update(researches).set({ status: 1 }).where(eq(researches.id, id));

        const fullQuery = `初期クエリ: ${query}\nフォローアップQ&A:\n${questions.map((q) => `Q: ${q.question}\nA: ${q.answer}`).join("\n")}`;

        const serpQueries = await step.do("generate-search-queries", async () => {
          return await this.generateSerpQueries(fullQuery, parseInt(breadth));
        });

        let allLearnings: string[] = [];
        let allUrls: string[] = [];

        for (const serpQuery of serpQueries) {
          try {
            const browserInstance = await browser.getActiveBrowser();

            const result = await step.do(`search-${serpQuery.query.substring(0, 20).replace(/\s+/g, "-")}`, async () => {
              return await webSearch(browserInstance, serpQuery.query, 5);
            });

            const extractedImages = result.flatMap((item) => item.images || []).filter((img) => img.url);

            const selectedImages = extractedImages.slice(0, 10 - allImages.length);

            if (selectedImages.length > 0) {
              for (const image of selectedImages) {
                try {
                  const checkResponse = await fetch(image.url, {
                    method: "HEAD",
                    headers: { Accept: "image/*" },
                  });

                  if (!checkResponse.ok || !checkResponse.headers.get("content-type")?.startsWith("image/")) {
                    console.log(`無効な画像URLをスキップ: ${image.url}`);
                    continue;
                  }

                  const analysis = await step.do(`analyze-image-${image.url.substring(0, 30).replace(/[^a-zA-Z0-9]/g, "-")}`, async () => {
                    return await this.analyzeImage(image.url);
                  });

                  if (analysis && typeof analysis === "string" && !analysis.includes("失敗")) {
                    allImages.push({
                      ...image,
                      analysis,
                    });

                    if (allImages.length >= 10) break;
                  }
                } catch (error) {
                  console.error(`画像分析エラー: ${image.url}`, error);
                }
              }
            }

            const { learnings, followUpQuestions } = await step.do(`process-results-${serpQuery.query.substring(0, 20).replace(/\s+/g, "-")}`, async () => {
              return await this.processSerpResult(serpQuery.query, result, Math.ceil(parseInt(breadth) / 2));
            });

            allLearnings = [...allLearnings, ...learnings];
            allUrls = [...allUrls, ...result.map((item) => item.url).filter(Boolean)];

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
              const nextQueries = await step.do(`generate-followup-queries-${serpQuery.query.substring(0, 15).replace(/\s+/g, "-")}`, async () => {
                return await this.generateSerpQueries(followUpQuestions.join("\n"), Math.ceil(parseInt(breadth) / 2), allLearnings);
              });

              for (const nextQuery of nextQueries) {
                const nextResult = await step.do(`deep-search-${nextQuery.query.substring(0, 15).replace(/\s+/g, "-")}`, async () => {
                  return await webSearch(browserInstance, nextQuery.query, 3);
                });

                const extractedDeepImages = nextResult.flatMap((item) => item.images || []).filter((img) => img.url);
                const selectedDeepImages = extractedDeepImages.slice(0, 10 - allImages.length);

                if (selectedDeepImages.length > 0) {
                  for (const image of selectedDeepImages) {
                    try {
                      const analysis = await step.do(`analyze-deep-image-${image.url.substring(0, 30).replace(/[^a-zA-Z0-9]/g, "-")}`, async () => {
                        return await this.analyzeImage(image.url);
                      });

                      allImages.push({
                        ...image,
                        analysis,
                      });

                      if (allImages.length >= 10) break;
                    } catch (error) {
                      console.error(`深層画像分析エラー: ${image.url}`, error);
                    }
                  }
                }

                const nextProcessResult = await step.do(`deep-process-${nextQuery.query.substring(0, 15).replace(/\s+/g, "-")}`, async () => {
                  return await this.processSerpResult(nextQuery.query, nextResult);
                });

                allLearnings = [...allLearnings, ...nextProcessResult.learnings];
                allUrls = [...allUrls, ...nextResult.map((item) => item.url).filter(Boolean)];
              }
            }
          } catch (error) {
            console.error(`クエリ処理エラー: ${serpQuery.query}`, error);
          }
        }

        const report = await step.do("write-final-report", async () => {
          return await this.writeFinalReport(fullQuery, allLearnings, allUrls, allImages);
        });

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
    const messages = [
      {
        role: "system",
        content: DEEP_SEARCH_QUERIES_PROMPT(),
      },
      {
        role: "user",
        content: `以下の研究課題に対して最大${numQueries}個の検索クエリを生成してください：${query}${learnings ? `\n参考情報：\n${learnings.join("\n")}` : ""}`,
      },
    ];

    console.log(`📄 検索クエリ生成開始`);
    const response = await this.env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", { messages, stream: false });
    // @ts-ignore
    const content: string = response.response;
    console.log(`📄 検索クエリ生成完了: ${content.substring(0, 100)}${content.length > 100 ? "..." : ""}`);

    const lines = content.split("\n").filter((line) => line.trim() !== "");
    const queries = lines.slice(0, numQueries).map((query) => ({
      query: query.replace(/^\d+\.\s*/, ""),
      researchGoal: "Gather information related to the main query",
    }));

    return queries;
  }

  async processSerpResult(query: string, result: any[], numFollowUpQuestions: number = 5, numLearnings: number = 5) {
    const contents = result.map((item) => item.markdown).filter(Boolean);

    if (contents.length === 0) {
      console.warn(`検索クエリ「${query}」の結果が空です`);
      return {
        learnings: ["検索結果が見つかりませんでした。"],
        followUpQuestions: ["他のキーワードで検索すべきですか？"],
      };
    }

    const messages = [
      {
        role: "system",
        content: DEEP_PROCESS_RESULTS_PROMPT(),
      },
      {
        role: "user",
        content: `以下の検索結果を分析してください：\n\n検索クエリ: ${query}\n\n検索結果:${contents.join("\n\n---\n\n")}`,
      },
    ];

    console.log(`📄 検索結果処理開始`);
    const response = await this.env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", { messages, stream: false });
    // @ts-ignore
    const content: string = response.response;
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

    return { learnings, followUpQuestions };
  }

  async analyzeImage(imageUrl: string) {
    try {
      console.log(`🖼️ 画像分析開始: ${imageUrl}`);

      const res = await fetch(imageUrl);
      const blob = await res.arrayBuffer();
      const input = {
        image: [...new Uint8Array(blob)],
        prompt: "この画像を分析して、何が写っているか説明してください。",
        max_tokens: 512,
      };

      const response = await this.env.AI.run("@cf/llava-hf/llava-1.5-7b-hf", input);
      return response.description;
    } catch (error) {
      console.error(`画像分析に失敗しました: ${error}`);
      return "画像の分析に失敗しました";
    }
  }

  async writeFinalReport(prompt: string, learnings: string[], visitedUrls: string[], images: any[] = []) {
    const imageMarkdowns = images.map((img, idx) => {
      return `[画像${idx + 1}: ${img.alt || "関連画像"}]\n- URL: ${img.url}\n- 説明: ${img.analysis || "説明なし"}`;
    });

    const imageInsertionPositions = images.length > 0 ? `\n\n記事内には以下の画像を適切な位置に挿入してください：\n${imageMarkdowns.join("\n\n")}` : "";

    const messages = [
      {
        role: "system",
        content: DEEP_FINAL_REPORT_PROMPT(),
      },
      {
        role: "user",
        content: `プロンプト「${prompt}」を使用して、以下のすべての知見を含むWebまとめ記事を作成してください。
記事の途中に画像を適切に配置してください。画像の位置は[画像1]、[画像2]のような形式で明示してください:\n\n${learnings
          .map((learning, index) => `${index + 1}. ${learning}`)
          .join("\n")}${imageInsertionPositions}`,
      },
    ];

    console.log(`📄 最終レポート生成開始`);
    const response = await this.env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", { messages, stream: false });
    // @ts-ignore
    let report: string = response.response;
    console.log(`📄 最終レポート生成完了: ${report.substring(0, 100)}${report.length > 100 ? "..." : ""}`);

    images.forEach((img, idx) => {
      const imgTag = `\n\n![${img.alt || `関連画像 ${idx + 1}`}](${img.url})\n*${img.analysis || "関連画像"}*\n\n`;
      report = report.replace(`[画像${idx + 1}]`, imgTag);
    });

    const urlsSection = `\n\n## 参考サイト\n\n${visitedUrls.map((url) => `- ${url}`).join("\n")}`;
    return report + urlsSection;
  }
}
