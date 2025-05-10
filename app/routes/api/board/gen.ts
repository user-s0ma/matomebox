import type { Route } from "./+types/gen";
import { ai } from "@/lib/gemini";
import type { DashboardItem } from "@/components/board/constants";

function itemDataToTextDescription(item: DashboardItem): string {
  let description = `Type: ${item.type}\n`;
  if (item.type === "note" || item.type === "text" || item.type === "image") {
    description += `Position: (${item.x}, ${item.y})\n`;
    description += `Size: (${item.width}w, ${item.height}h)\n`;
  }
  if (item.type === "note" || item.type === "text") {
    description += `Content: "${item.content || ""}"\n`;
    description += `FontSize: ${item.fontSize}\n`;
    if (item.type === "note") description += `Color: ${item.color}\n`;
    if (item.type === "text") {
      description += `Color: ${item.color}\n`;
      description += `TextAlign: ${item.textAlign}\n`;
    }
  } else if (item.type === "line") {
    const pointsStr = item.points.map((p) => `(${p.x}, ${p.y})`).join("; ");
    description += `Points: [${pointsStr}]\n`;
    description += `Color: ${item.color}\n`;
    description += `Width: ${item.width}\n`;
    description += `PenType: ${item.penType}\n`;
  } else if (item.type === "image") {
    description += `Source: (Image data - context is an image at this position/size. Do not try to generate image content.)\n`;
  }
  return description;
}

function parseAndEnqueue(buffer: string, controller: ReadableStreamDefaultController, encoder: TextEncoder): string {
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  let objStart = -1;

  for (let i = 0; i < buffer.length; i++) {
    const ch = buffer[i];

    if (escapeNext) {
      escapeNext = false;
    } else if (ch === "\\") {
      escapeNext = true;
    } else if (ch === '"' && !escapeNext) {
      inString = !inString;
    }

    if (!inString) {
      if (ch === "{") {
        if (depth === 0) {
          objStart = i;
        }
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0 && objStart >= 0) {
          const jsonStr = buffer.slice(objStart, i + 1);
          buffer = buffer.slice(i + 1);
          i = -1;
          objStart = -1;

          try {
            const item = JSON.parse(jsonStr) as Omit<DashboardItem, "id" | "zIndex" | "isSelected">;
            const sse = `data: ${JSON.stringify(item)}\n\n`;
            controller.enqueue(encoder.encode(sse));
          } catch (e) {
            console.error("[parseAndEnqueue] JSON parse error:", e, jsonStr);
          }
        }
      }
    }
  }

  return buffer;
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method === "POST") {
    try {
      const payload = (await request.json()) as { itemsData?: DashboardItem[]; prompt?: string };
      const { itemsData, prompt } = payload;

      if (!Array.isArray(itemsData)) {
        return Response.json({ error: "Invalid payload: 'itemsData' (array) is required." }, { status: 400 });
      }

      const contextDescriptions = itemsData.map(itemDataToTextDescription).join("\n---\n");
      const fullPrompt = `
    あなたは高度なホワイトボード整理アシスタントです。
    ユーザーからの指示と、提供された既存のボードアイテムの情報を分析し、情報を専門的で豪華かつ視覚的に分かりやすく再構成・追記してください。
    カラフルでポップな見た目にしてください。
    
    ユーザーの指示: ${prompt ? prompt : "提供された既存のボードアイテムに合わせて出力してください。"}
    
    提供された既存のボードアイテムのコンテキスト:
    ${
      contextDescriptions.length > 0
        ? contextDescriptions
        : "現在、選択されているアイテムはありません。既存のアイテムがない場合は、ユーザーの指示に基づいて自由に新しいアイテムを生成してください。"
    }

    以下の指示に従って、既存のボードアイテムに追加するボードアイテムを生成してください:
    1.  **情報の整理と構造化:** ユーザーの指示と既存のコンテキストから主要なテーマ、アイデア、タスク、関連情報などを抽出し、それらを論理的にグループ化・階層化してください。
    2.  **視覚的な魅力:**
        *   **付箋 (note):** 重要なポイントやアイデアを付箋で表現します。関連性の高い情報は同じような色の付箋にするか、テーマごとに色分けしたり、マーカー('highlighter')を引いたりするなど、色彩を効果的に使用してください。内容に合わせて付箋のサイズを調整しても構いません。
        *   **テキスト (text):** 見出し、説明文、注釈などをテキストアイテムで表現します。情報の重要度に応じてフォントサイズ (例: "24px", "18px", "14px") やtextAlignを調整し、階層構造が分かるようにしてください。重要なキーワードはテキスト内容に含めてください。
        *   **線 (line):** 関連するアイテム同士を線で結びつけたり、情報を区切るための境界線として使用したりしてください。線の色や太さも、デザインの一部として考慮してください。矢印のような表現もポイントの組み合わせで可能です。
    3.  **配置の工夫:** 新しく生成するアイテムは、既存のアイテムや他の生成アイテムの座標やサイズなどを考慮して、絶対に重ならないように余裕をもって配置してください。ボードを効果的に使い、見やすいレイアウトを心がけてください。座標 (x, y) は、一般的なホワイトボードの感覚で現存のアイテムの近くに設定してください。
    4.  **創造性と実用性:** 単に情報を並べるだけでなく、ユーザーが内容を理解しやすく、さらにアイデアが広がるような、創造的で実用的なまとめを目指してください。
    
    出力形式:
    *   出力は単一のJSON配列の形式で、各要素はボードアイテムを表すオブジェクトとします。
    *   座標 (x, y)、サイズ (width, height)、線の太さ (width) は数値です。
    *   色は#RRGGBB形式、fontSizeは '16px' のような文字列、textAlignは 'left'|'center'|'right'、penTypeは 'pen'|'highlighter' です。
    
    利用可能なアイテムタイプとプロパティの例 (この形式のJSON配列で返してください):
    [
      {
        "type": "note",
        "content": "【主要テーマA】の概要",
        "x": 150,
        "y": 100,
        "width": 250,
        "height": 120,
        "color": "#D1E8FF", 
        "fontSize": "18px"
      },
      {
        "type": "text",
        "content": "詳細な説明ポイント1",
        "x": 160,
        "y": 250,
        "width": 230,
        "height": "auto",
        "color": "#333333",
        "fontSize": "14px",
        "textAlign": "left"
      },
      {
        "type": "line",
        "points": [{ "x": 275, "y": 220 }, { "x": 275, "y": 240 }], 
        "color": "#555555",
        "width": 2,
        "penType": "pen"
      }
    ]
    
    生成するアイテムがない場合は、空のJSON配列 "[]" を返してください。
    必ず純粋なJSON配列として返してください。説明文や \`\`\`json のようなマークダウンは絶対に含めないでください。
    `;

      const geminiStream = await ai.models.generateContentStream({
        model: "gemini-2.5-flash-preview-04-17",
        contents: fullPrompt,
        config: { responseMimeType: "application/json" },
      });
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          let buffer = "";

          try {
            for await (const chunk of geminiStream) {
              const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (typeof text !== "string") continue;
              buffer += text;
              buffer = parseAndEnqueue(buffer, controller, encoder);
            }

            buffer = parseAndEnqueue(buffer, controller, encoder);

            controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ message: "Stream completed" })}\n\n`));
          } catch (e: any) {
            const err = JSON.stringify({ error: "Stream error", details: e.message });
            controller.enqueue(encoder.encode(`event: error\ndata: ${err}\n\n`));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
    } catch (error) {
      console.error(error);
      return Response.json({ error: "内部サーバーエラーが発生しました。" }, { status: 500 });
    }
  } else {
    return Response.json({ error: "Method Not Allowed" }, { status: 405 });
  }
}
