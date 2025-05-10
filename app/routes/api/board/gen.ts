// app/routes/api/board/gen.ts
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

export async function action({ request }: Route.ActionArgs) {
  if (request.method === "POST") {
    try {
      const payload = (await request.json()) as { itemsData?: DashboardItem[]; prompt?: string };
      const { itemsData, prompt } = payload;

      if (!prompt || !Array.isArray(itemsData)) {
        return Response.json({ error: "Invalid payload: 'prompt' (string) and 'itemsData' (array) are required." }, { status: 400 });
      }

      const contextDescriptions = itemsData.map(itemDataToTextDescription).join("\n---\n");

      const fullPrompt = `
ユーザーの指示: ${prompt}

提供されたボードアイテムのコンテキスト:
${contextDescriptions.length > 0 ? contextDescriptions : "現在、選択されているアイテムはありません。"}

指示に基づいて、新しいボードアイテムを生成してください。
出力はJSON配列の形式で、各要素は以下の構造を持つオブジェクトとします。
typeに応じて必須のプロパティとオプショナルなプロパティがあります。
id, zIndex, isSelected はクライアント側で付与するので、絶対に含めないでください。
座標 (x, y) やサイズ (width, height)、線の太さ (width) は数値で指定してください。
色は#RRGGBB形式です。
fontSizeは '16px' のような文字列です。
textAlignは 'left', 'center', 'right' のいずれかです。
penTypeは 'pen', 'highlighter' のいずれかです。
生成するアイテムの座標やサイズは、既存のアイテムと重複しないように、またボードの一般的な範囲 (例: x,yが0から数千の範囲) を考慮してください。

利用可能なアイテムタイプとプロパティの例 (この形式のJSON配列で返してください):
[
  {
    "type": "note",
    "content": "生成された付箋のテキスト",
    "x": 100,
    "y": 150,
    "width": 200,
    "height": 150,
    "color": "#FFFF88",
    "fontSize": "16px"
  },
  {
    "type": "text",
    "content": "生成されたテキスト",
    "x": 300,
    "y": 250,
    "width": 250,
    "height": "auto",
    "color": "#333333",
    "fontSize": "20px",
    "textAlign": "center"
  },
  {
    "type": "line",
    "points": [{ "x": 50, "y": 50 }, { "x": 150, "y": 150 }, { "x": 50, "y": 150 }],
    "color": "#0000FF",
    "width": 3,
    "penType": "pen"
  }
]

生成するアイテムがない場合は、空のJSON配列 "[]" を返してください。
必ず純粋なJSON配列として返してください。説明文や \`\`\`json のようなマークダウンは絶対に含めないでください。
`;
      const geminiResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
        config: {
          responseMimeType: "application/json",
        },
      });

      const responseText = geminiResponse.text;

      console.log("Raw Gemini Response Text:", responseText);

      if (!responseText) {
        console.error("Gemini response was empty.");
        return Response.json({ error: "AI model returned an empty response." }, { status: 500 });
      }

      const newItems = JSON.parse(responseText) as Omit<DashboardItem, "id" | "zIndex" | "isSelected">[];

      if (!Array.isArray(newItems)) {
        console.error("Parsed Gemini response is not an array:", newItems);
        return Response.json({ error: "AI model returned data in unexpected format (not an array).", rawResponse: responseText }, { status: 500 });
      }

      return Response.json(newItems, { status: 200 });
    } catch (error) {
      console.error(error);
      return Response.json({ success: false, error: "内部サーバーエラーが発生しました。" }, { status: 500 });
    }
  }
  return Response.json({ error: "Method Not Allowed" }, { status: 405 });
}
