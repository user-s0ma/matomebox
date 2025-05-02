import { imageSize } from "image-size";
import { model } from "@/lib/gemini";

type ImageData = {
  id: string;
  url: string;
  alt?: string;
  analysis?: string;
  sourceUrl: string;
};

export class ImageProcessor {
  async processArticleWithImages(articleText: string, images: ImageData[], prompt: string): Promise<{ content: string; firstImageUrl?: string }> {
    const analyzedImages = await this.analyzeAllImages(images);
    const result = await this.createIntegratedArticle(articleText, analyzedImages, prompt);

    const firstImageMatch = result.match(/!\[.*?\]\((.*?)\)/);
    const firstImageUrl = firstImageMatch ? firstImageMatch[1] : undefined;

    return { content: result, firstImageUrl };
  }

  public async analyzeAllImages(images: ImageData[]): Promise<ImageData[]> {
    const analyzedImages: ImageData[] = [];

    for (const image of images) {
      if (image.analysis) {
        analyzedImages.push(image);
        continue;
      }

      try {
        const res = await fetch(image.url);
        if (!res.ok) {
          continue;
        }

        const blob = await res.arrayBuffer();
        const analysis = await this.analyzeImage(blob, res.headers.get("content-type"));

        const dimensions = imageSize(new Uint8Array(blob));
        if (!dimensions || (dimensions.width < 250 && dimensions.height < 250)) {
          continue;
        }

        analyzedImages.push({
          ...image,
          analysis,
        });
      } catch (error) {
        console.error(`画像処理エラー: ${image.url}`, error);
      }
    }

    return analyzedImages;
  }

  private async analyzeImage(blob: ArrayBuffer, contentType?: string | null): Promise<string> {
    try {
      const prompt = `
        あなはプロの視覚分析専門家です。この画像を詳細に分析してください。

        分析の際には、以下の点に注意してください：
        1. 誰が（人物）、何が（物・事象）、どこで（場所）、どのように（状況）写っているか
        2. 「この画像には〜」という表現は使わず、直接内容を説明する
        3. HTMLタグは一切使用しない

        分析結果は3段落で構成してください：
        - 第1段落: 主要な被写体と状況の概要
        - 第2段落: 細部の詳細
        - 第3段落: 文脈における意味
        `;

      const { response } = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: Buffer.from(blob).toString("base64"),
            mimeType: contentType || "application/octet-stream",
          },
        },
      ]);

      return response.text();
    } catch (error) {
      console.error(`画像分析に失敗しました: ${error}`);
      throw error;
    }
  }

  private async createIntegratedArticle(articleText: string, images: ImageData[], initialPrompt: string): Promise<string> {
    const prompt = `
    あなたはプロのニュース編集者です。以下のテキスト記事と分析済みの画像を最適に統合し、与えられた制限内で簡潔なマークダウン記事を作成してください。
    
    【記事本文】
    ${articleText}
    
    【利用可能な画像】(最大4枚)
    ${images
      .map(
        (img, index) => `[画像${index + 1}] ID: ${img.id}
    説明: ${img.analysis || "説明なし"}
    URL: ${img.url}
    ソース: ${img.sourceUrl.replace(/^https?:\/\//, "") || "不明"}`
      )
      .join("\n\n")}
    
    【出力形式の制限】
    使用可能なマークダウン要素のみを使ってください：
    # タイトル  
    ## 見出し  
    ### サブ見出し  
    通常テキスト  
    ![代替テキスト](画像URL)  
    *キャプション（出典: https://ソースURL）*  
    **太字テキスト**  
    [リンクテキスト](URL)  
    
    禁止事項：
    リスト、コードブロック、水平線、斜体（キャプション除く）、インラインコード、HTMLタグ  
    
    アクセスできない、収集できなかったなど、
    初期プロントの「${initialPrompt}」に直接関係しない情報はすべて省略し、重要なポイントを簡潔にまとめてください。
    `;

    try {
      const { response } = await model.generateContent([prompt]);
      return response.text();
    } catch (error) {
      console.error("記事と画像の統合に失敗しました:", error);

      let result = "# " + articleText.split("\n")[0];

      const paragraphs = articleText.split("\n\n");

      if (paragraphs.length > 1) {
        result += "\n\n## " + paragraphs[1];
      }

      let imageCount = 0;
      for (let i = 2; i < paragraphs.length; i++) {
        if (i % 3 === 0 && imageCount < images.length) {
          const image = images[imageCount];
          const caption = image.alt || "関連画像";
          result += `\n\n![${caption}](${image.url})\n*${caption}*`;
          imageCount++;
        }

        if (i % 4 === 0) {
          result += "\n\n### " + paragraphs[i];
        } else {
          result += "\n\n" + paragraphs[i];
        }
      }

      for (let i = imageCount; i < images.length; i++) {
        const image = images[i];
        const caption = image.alt || "関連画像";
        result += `\n\n![${caption}](${image.url})\n*${caption}*`;
      }

      return result;
    }
  }
}
