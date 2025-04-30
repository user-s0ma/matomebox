import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { researches, researchImages, researchSources, researchProgress } from "@/db/schema";
import { getDrizzleClient } from "@/lib/db";
import { model } from "@/lib/gemini";
import { getBrowser, webSearch } from "@/lib/webSearch";
import { DEEP_SEARCH_QUERIES_PROMPT, DEEP_PROCESS_RESULTS_PROMPT, DEEP_FINAL_REPORT_PROMPT } from "@/lib/prompts";
import { ImageProcessor } from "@/lib/imageProcessor";

interface ResearchParams {
  id: string;
  query: string;
  depth: number;
  breadth: number;
  questions: Array<{ question: string; answer: string }>;
}

export class ResearchWorkflow extends WorkflowEntrypoint<Env, ResearchParams> {
  async run(event: WorkflowEvent<ResearchParams>, step: WorkflowStep) {
    try {
      const db = getDrizzleClient();
      const browser = await getBrowser();

      const { id } = event.payload;

      try {
        const { query, depth, breadth } = event.payload;

        await db
          .update(researches)
          .set({
            status: 1,
            updated_at: new Date(),
          })
          .where(eq(researches.id, id));

        await db.insert(researchProgress).values({
          research_id: id,
          status_message: "検索クエリを生成中...",
          progress_percentage: 0,
        });

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
            return await this.generateSerpQueries(query, breadth);
          }
        );

        let allLearnings: string[] = [];
        let totalQueriesCount = serpQueries.length;
        let processedQueriesCount = 0;

        for (const serpQuery of serpQueries) {
          try {
            const browserInstance = await browser.getActiveBrowser();

            await db.insert(researchProgress).values({
              research_id: id,
              status_message: `検索クエリ「${serpQuery.query}」を実行中...`,
              progress_percentage: Math.round((processedQueriesCount / totalQueriesCount) * 100),
            });

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

            for (const item of result) {
              try {
                const urlObj = new URL(item.url);
                await db.insert(researchSources).values({
                  research_id: id,
                  url: item.url,
                  domain: urlObj.hostname,
                  title: item.title || "",
                  description: item.description || "",
                });
              } catch (error) {
                console.error(`URL解析エラー: ${item.url}`, error);
              }
            }

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
                return await this.processSerpResult(serpQuery.query, result, Math.ceil(breadth / 2));
              }
            );

            allLearnings = [...allLearnings, ...learnings];

            if (processedImages && processedImages.length > 0) {
              for (const img of processedImages.slice(0, 10)) {
                await db.insert(researchImages).values({
                  research_id: id,
                  url: img.url,
                  alt: img.alt || "",
                  analysis: img.analysis || "",
                });
              }
            }

            processedQueriesCount++;

            await db.insert(researchProgress).values({
              research_id: id,
              status_message: `検索の処理完了`,
              progress_percentage: Math.round((processedQueriesCount / totalQueriesCount) * 100),
            });

            if (depth > 1 && followUpQuestions.length > 0) {
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
                  return await this.generateSerpQueries(followUpQuestions.join("\n"), Math.ceil(breadth / 2), allLearnings);
                }
              );

              totalQueriesCount += nextQueries.length;

              for (const nextQuery of nextQueries) {
                await db.insert(researchProgress).values({
                  research_id: id,
                  status_message: `詳細検索「${nextQuery.query}」を実行中...`,
                  progress_percentage: Math.round((processedQueriesCount / totalQueriesCount) * 100),
                });

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

                for (const item of nextResult) {
                  try {
                    const urlObj = new URL(item.url);
                    await db.insert(researchSources).values({
                      research_id: id,
                      url: item.url,
                      domain: urlObj.hostname,
                      title: item.title || "",
                      description: item.description || "",
                    });
                  } catch (error) {
                    console.error(`URL解析エラー: ${item.url}`, error);
                  }
                }

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

                if (nextProcessResult.processedImages && nextProcessResult.processedImages.length > 0) {
                  for (const img of nextProcessResult.processedImages.slice(0, 5)) {
                    await db.insert(researchImages).values({
                      research_id: id,
                      url: img.url,
                      alt: img.alt || "",
                      analysis: img.analysis || "",
                    });
                  }
                }

                processedQueriesCount++;

                await db.insert(researchProgress).values({
                  research_id: id,
                  status_message: `詳細検索の処理完了`,
                  progress_percentage: Math.round((processedQueriesCount / totalQueriesCount) * 100),
                });
              }
            }
          } catch (error) {
            console.error(`クエリ処理エラー: ${serpQuery.query}`, error);
          }
        }

        const images = await db.query.researchImages.findMany({
          where: eq(researchImages.research_id, id),
        });

        await db.insert(researchProgress).values({
          research_id: id,
          status_message: "最終レポートを生成中...",
          progress_percentage: 90,
        });

        const sources = await db.query.researchSources.findMany({
          where: eq(researchSources.research_id, id),
        });
        const sourceUrls = sources.map((source) => source.url);

        const reportResult = await step.do(
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
            return await this.writeFinalReport(query, allLearnings, sourceUrls, images);
          }
        );

        await db.insert(researchProgress).values({
          research_id: id,
          status_message: "完了",
          progress_percentage: 100,
        });

        const content = reportResult.content.replaceAll("```markdown", "").replaceAll("```", "");
        const title = content.split("\n")[0].replace("#", "").trim().substring(0, 50);
        const category = reportResult.category;

        await db
          .update(researches)
          .set({
            content,
            title,
            category,
            status: 2,
            updated_at: new Date(),
          })
          .where(eq(researches.id, id));

        return { success: true, learningsCount: allLearnings.length, imagesCount: images.length };
      } catch (error) {
        console.error("リサーチプロセス失敗:", error);

        await db
          .update(researches)
          .set({
            status: 3,
            content: `エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
            updated_at: new Date(),
          })
          .where(eq(researches.id, id));

        await db.insert(researchProgress).values({
          research_id: id,
          status_message: `エラー: ${error instanceof Error ? error.message : String(error)}`,
          progress_percentage: 0,
        });

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
    const { response } = await model.generateContent([
      DEEP_SEARCH_QUERIES_PROMPT() +
        `\n\n以下のテーマに関する検索クエリを${numQueries}個生成してください：\n${query}${learnings ? `\n\n参考情報：\n${learnings.join("\n")}` : ""}`,
    ]);
    const content = response.text();

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

    const { response } = await model.generateContent([
      DEEP_PROCESS_RESULTS_PROMPT() + `以下の検索結果を分析してください：\n\n検索クエリ: ${query}\n\n検索結果:${contentsWithImages.join("\n\n---\n\n")}`,
    ]);
    const content = response.text();

    const factSection = content.match(/##\s*報道価値のある事実[\s\S]*?(?=##|$)/) || [""];
    const questionSection = content.match(/##\s*フォローアップ質問[\s\S]*?(?=##|$)/) || [""];

    let learnings: string[] = [];
    if (factSection[0]) {
      learnings = factSection[0]
        .replace(/##\s*報道価値のある事実/, "")
        .split(/\d+\.\s+/)
        .slice(1)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, numLearnings);
    }

    let followUpQuestions: string[] = [];
    if (questionSection[0]) {
      followUpQuestions = questionSection[0]
        .replace(/##\s*フォローアップ質問/, "")
        .split(/\d+\.\s+/)
        .slice(1)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, numFollowUpQuestions);
    }

    return { learnings, followUpQuestions, processedImages };
  }

  async determineCategory(query: string, learnings: string[]): Promise<string> {
    try {
      const categoryPrompt = `
        以下の記事トピックと収集した情報から、最も適切なカテゴリーを1つだけ選んでください。
    
        カテゴリー選択肢:
        - 国内: 日本国内のニュース、政治、社会問題など
        - 国際: 海外のニュース、国際関係、世界情勢など
        - 経済: 経済、金融、ビジネス、企業動向など
        - エンタメ: 芸能、映画、音楽、アニメ、マンガなど
        - スポーツ: スポーツ全般、試合結果、選手情報など
        - IT: テクノロジー、デジタル、インターネット、AI、サイエンスなど
        - ライフ: 健康、教育、生活、料理、ファッションなど
        - その他: 上記に該当しないもの
    
        記事トピック: ${query}
    
        収集情報:
        ${learnings.slice(0, 5).join("\n")}
    
        回答は上記カテゴリーから1つだけ選び、カテゴリー名のみを返してください。
        `;

      const { response } = await model.generateContent([categoryPrompt]);
      const category = response.text().trim();

      const validCategories = ["国内", "国際", "経済", "エンタメ", "スポーツ", "IT", "ライフ", "その他"];

      if (validCategories.includes(category)) {
        return category;
      } else {
        console.warn(`不明なカテゴリー「${category}」が返されました。「その他」に分類します。`);
        return "その他";
      }
    } catch (error) {
      console.error("カテゴリー判定エラー:", error);
      return "その他";
    }
  }

  async generateArticleDraft(prompt: string, learnings: string[]): Promise<string> {
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

      return draft;
    } catch (error) {
      console.error("記事ドラフト生成エラー:", error);
      return learnings.join("\n\n");
    }
  }

  async writeFinalReport(prompt: string, learnings: string[], visitedUrls: string[], images: any[] = []) {
    try {
      const category = await this.determineCategory(prompt, learnings);

      const articleDraft = await this.generateArticleDraft(prompt, learnings);

      const imageProcessor = new ImageProcessor();
      const finalArticle = await imageProcessor.processArticleWithImages(articleDraft, images);

      return { content: finalArticle, category: category };
    } catch (error) {
      const { response } = await model.generateContent([
        DEEP_FINAL_REPORT_PROMPT() +
          `プロンプト「${prompt}」を使用して、収集した情報に基づいて記事を作成してください。\n\n` +
          `${learnings.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
      ]);
      const basicReport = response.text();

      return { content: basicReport, category: "その他" };
    }
  }
}
