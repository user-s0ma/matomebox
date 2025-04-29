import { model } from "@/lib/gemini";

type ImageData = {
  id: string;
  url: string;
  alt?: string;
  analysis?: string;
};

export class ImageProcessor {
  private articleSegmenter: ArticleSegmenter;
  private imageContentMatcher: ImageContentMatcher;

  constructor() {
    this.articleSegmenter = new ArticleSegmenter();
    this.imageContentMatcher = new ImageContentMatcher();
  }
  async processImagesForArticle(articleText: string, images: ImageData[]): Promise<string> {
    const segments = await this.articleSegmenter.segmentArticle(articleText);

    const imagePlacements = [];

    for (const image of images) {
      const analyzedImage = await this.analyzeImage(image);

      const placements = await this.imageContentMatcher.matchImageToContent(analyzedImage.analysis || "", segments);

      if (placements.length > 0) {
        const bestPlacement = placements.sort((a, b) => b.score - a.score)[0];

        imagePlacements.push({
          imageId: analyzedImage.id,
          segmentId: bestPlacement.segmentId,
          position: bestPlacement.position,
        });
      }
    }

    return this.constructArticleWithImageTags(segments, imagePlacements, images);
  }

  private async analyzeImage(image: ImageData): Promise<ImageData> {
    if (image.analysis) return image;

    try {
      const res = await fetch(image.url);
      const blob = await res.arrayBuffer();

      const { response } = await model.generateContent([
        "この画像には何が表示されていますか？詳しく説明してください。",
        {
          inlineData: {
            data: Buffer.from(blob).toString("base64"),
            mimeType: res.headers.get("content-type") || "application/octet-stream",
          },
        },
      ]);

      return {
        ...image,
        analysis: response.text(),
      };
    } catch (error) {
      console.error(`画像分析エラー: ${image.url}`, error);
      return {
        ...image,
        analysis: "画像の分析に失敗しました",
      };
    }
  }

  private constructArticleWithImageTags(
    segments: Array<{ id: string; text: string; position: number }>,
    placements: Array<{ imageId: string; segmentId: string; position: string }>,
    images: ImageData[]
  ): string {
    const sortedSegments = [...segments].sort((a, b) => a.position - b.position);

    let articleWithTags = "";

    for (const segment of sortedSegments) {
      const placement = placements.find((p) => p.segmentId === segment.id);

      if (placement) {
        if (placement.position === "before") {
          articleWithTags += `\n\n[IMAGE_TAG_${placement.imageId}]\n\n${segment.text}\n\n`;
        } else if (placement.position === "after") {
          articleWithTags += `${segment.text}\n\n[IMAGE_TAG_${placement.imageId}]\n\n`;
        } else {
          const lines = segment.text.split("\n");
          const midPoint = Math.floor(lines.length / 2);

          const firstHalf = lines.slice(0, midPoint).join("\n");
          const secondHalf = lines.slice(midPoint).join("\n");

          articleWithTags += `${firstHalf}\n\n[IMAGE_TAG_${placement.imageId}]\n\n${secondHalf}\n\n`;
        }
      } else {
        articleWithTags += `${segment.text}\n\n`;
      }
    }

    const placedImageIds = placements.map((p) => p.imageId);
    const unplacedImages = images.filter((img) => !placedImageIds.includes(img.id));

    if (unplacedImages.length > 0) {
      articleWithTags += "\n\n";

      for (const image of unplacedImages) {
        articleWithTags += `[IMAGE_TAG_${image.id}]\n\n`;
      }
    }

    return articleWithTags.trim();
  }
}
class ImageContentMatcher {
  async matchImageToContent(
    imageAnalysis: string,
    contentSegments: Array<{ id: string; text: string; type: string }>
  ): Promise<Array<{ segmentId: string; score: number; position: string }>> {
    const prompt = `
画像と記事のセグメントがあります。この画像の最適な配置を決定してください。

画像分析:
${imageAnalysis}

記事セグメント:
${contentSegments.map((s) => `[${s.id}] (${s.type}): ${s.text.substring(0, 100)}...`).join("\n\n")}

コンテンツとの関連性に基づいて、この画像を配置するのに最適なセグメントを関連性スコア（0〜1）と位置（before/after/within）で推奨してください。
segmentId、score、positionフィールドを持つJSON配列で返してください。
    `;

    try {
      const { response } = await model.generateContent(["あなたはコンテンツレイアウトとデザインの専門家です。" + prompt]);

      // @ts-ignore
      const jsonMatch = response.text().match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return [];
    } catch (error) {
      console.error("画像配置分析エラー:", error);
      return [];
    }
  }
}

class ArticleSegmenter {
  async segmentArticle(articleText: string): Promise<
    Array<{
      id: string;
      text: string;
      type: string;
      position: number;
    }>
  > {
    const prompt = `
以下の記事を論理的な部分に分割してください。各セグメントのタイプ（タイトル、導入部、本文、引用、統計情報、結論など）を特定してください。
id、text、type、positionフィールドを持つJSON配列として返してください。

記事:
${articleText}
    `;

    try {
      const { response } = await model.generateContent(["あなたはコンテンツ構造と分析の専門家です。" + prompt]);

      // @ts-ignore
      const jsonMatch = response.text().match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return this.simpleSegmentation(articleText);
    } catch (error) {
      console.error("セグメンテーションエラー:", error);
      return this.simpleSegmentation(articleText);
    }
  }

  private simpleSegmentation(text: string): Array<{
    id: string;
    text: string;
    type: string;
    position: number;
  }> {
    const paragraphs = text.split(/\n\n+/);

    return paragraphs.map((p, index) => ({
      id: `segment-${index}`,
      text: p.trim(),
      type: index === 0 ? "導入部" : index === paragraphs.length - 1 ? "結論" : "本文",
      position: index,
    }));
  }
}
