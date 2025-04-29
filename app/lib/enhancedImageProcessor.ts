import { model } from "@/lib/gemini";
import { IMAGE_ANALYSIS_PROMPT, OPTIMIZED_IMAGE_PLACEMENT_PROMPT } from "@/lib/prompts";

type ImageData = {
  id: string;
  url: string;
  alt?: string;
  analysis?: string;
};

export class EnhancedImageProcessor {
  async integrateImagesWithArticle(articleText: string, images: ImageData[]): Promise<string> {
    const analyzedImages = await this.analyzeAllImages(images);

    const optimizedArticle = await this.optimizeImagePlacement(articleText, analyzedImages);

    return optimizedArticle;
  }

  private async analyzeAllImages(images: ImageData[]): Promise<ImageData[]> {
    const analyzedImages: ImageData[] = [];

    for (const image of images) {
      if (image.analysis) {
        analyzedImages.push(image);
        continue;
      }

      try {
        const analysis = await this.analyzeImage(image.url);
        analyzedImages.push({
          ...image,
          analysis,
        });
      } catch (error) {
        console.error(`画像分析エラー: ${image.url}`, error);
        analyzedImages.push({
          ...image,
          analysis: "画像の分析に失敗しました",
        });
      }
    }

    return analyzedImages;
  }

  private async analyzeImage(imageUrl: string): Promise<string> {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.arrayBuffer();

      const { response } = await model.generateContent([
        IMAGE_ANALYSIS_PROMPT(),
        {
          inlineData: {
            data: Buffer.from(blob).toString("base64"),
            mimeType: res.headers.get("content-type") || "application/octet-stream",
          },
        },
      ]);

      return response.text();
    } catch (error) {
      console.error(`画像分析に失敗しました: ${error}`);
      return "画像の分析に失敗しました";
    }
  }

  private async optimizeImagePlacement(articleText: string, images: ImageData[]): Promise<string> {
    if (articleText.length > 10000 && images.length > 1) {
      return this.processLongArticle(articleText, images);
    }

    const prompt =
      OPTIMIZED_IMAGE_PLACEMENT_PROMPT() +
      `
        【記事本文】
        ${articleText}

        【利用可能な画像】
        ${images
          .map(
            (img, index) => `[画像${index + 1}] ID: ${img.id}
              説明: ${img.analysis || "説明なし"}
              `
                )
                .join("\n\n")}

        【指示】
        1. 記事の内容と各画像の内容を分析し、最も関連性の高い位置に画像を配置してください
        2. 各画像は記事内で最大1回だけ使用してください
        3. すべての画像を使用する必要はありません。記事と明確な関連がない画像は使用しないでください
        4. 画像は必ず段落間（段落の前後）に配置し、段落の途中には挿入しないでください
        5. 記事の最初と最後にも画像を配置できます
        6. 画像を追加する際は、元の記事テキストをそのまま維持し、画像タグ [IMAGE_TAG_画像ID] のみを挿入してください

        【出力形式】
        画像タグ [IMAGE_TAG_画像ID] を適切な位置に挿入した完全な記事テキストを返してください。
        それ以外の修正や追加コメントは含めないでください。
      `;

    try {
      const { response } = await model.generateContent([prompt]);
      let optimizedArticle = response.text();

      optimizedArticle = optimizedArticle
        .replace(/```markdown/g, "")
        .replace(/```/g, "")
        .replace(/^記事：/gm, "")
        .trim();

      return optimizedArticle;
    } catch (error) {
      console.error("画像配置の最適化に失敗しました:", error);

      let articleWithImages = articleText;

      images.forEach((image) => {
        articleWithImages += `\n\n[IMAGE_TAG_${image.id}]\n\n`;
      });

      return articleWithImages;
    }
  }

  private async processLongArticle(articleText: string, images: ImageData[]): Promise<string> {
    const paragraphs = articleText.split(/\n\n+/);

    const sectionSize = Math.ceil(paragraphs.length / (images.length + 1));
    const sections = [];

    for (let i = 0; i < paragraphs.length; i += sectionSize) {
      sections.push(paragraphs.slice(i, i + sectionSize).join("\n\n"));
    }

    const sectionImageAssignments = await this.assignImagesToSections(sections, images);

    let result = "";

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const assignedImage = sectionImageAssignments[i];

      if (assignedImage) {
        if (Math.random() > 0.5) {
          result += `\n\n[IMAGE_TAG_${assignedImage.id}]\n\n${section}\n\n`;
        } else {
          result += `${section}\n\n[IMAGE_TAG_${assignedImage.id}]\n\n`;
        }
      } else {
        result += `${section}\n\n`;
      }
    }

    return result;
  }

  private async assignImagesToSections(sections: string[], images: ImageData[]): Promise<(ImageData | null)[]> {
    const assignments: (ImageData | null)[] = Array(sections.length).fill(null);

    const availableImages = [...images];

    for (let i = 0; i < sections.length && availableImages.length > 0; i++) {
      const section = sections[i];

      const bestImageIndex = await this.findBestImageForSection(section, availableImages);

      if (bestImageIndex !== -1) {
        assignments[i] = availableImages[bestImageIndex];
        availableImages.splice(bestImageIndex, 1);
      }
    }

    return assignments;
  }

  private async findBestImageForSection(sectionText: string, availableImages: ImageData[]): Promise<number> {
    if (availableImages.length === 0) return -1;
    if (availableImages.length === 1) return 0;

    const prompt = `
      あなたはコンテンツキュレーターです。以下のテキストセクションに最も関連性の高い画像を選んでください。

      【テキストセクション】
      ${sectionText}

      【利用可能な画像】
      ${availableImages.map((img, index) => `[${index}]: ${img.analysis || "説明なし"}`).join("\n\n")}

      最も関連性の高い画像の番号（0から始まる配列インデックス）のみを返してください。例: 2
    `;

    try {
      const { response } = await model.generateContent([prompt]);
      const result = response.text().trim();

      const match = result.match(/\d+/);
      if (match) {
        const index = parseInt(match[0], 10);
        if (index >= 0 && index < availableImages.length) {
          return index;
        }
      }

      return Math.floor(Math.random() * availableImages.length);
    } catch (error) {
      console.error("最適な画像の選択に失敗しました:", error);
      return Math.floor(Math.random() * availableImages.length);
    }
  }
}
