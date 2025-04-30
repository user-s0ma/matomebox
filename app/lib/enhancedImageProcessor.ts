import { model } from "@/lib/gemini";

type ImageData = {
  id: string;
  url: string;
  alt?: string;
  analysis?: string;
};

export class EnhancedImageProcessor {
  async processArticleWithImages(articleText: string, images: ImageData[]): Promise<string> {
    const analyzedImages = await this.analyzeAllImages(images);

    return await this.createIntegratedArticle(articleText, analyzedImages);
  }

  public async analyzeAllImages(images: ImageData[]): Promise<ImageData[]> {
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

  // app/lib/enhancedImageProcessor.ts の createIntegratedArticle メソッドを更新

  private async createIntegratedArticle(articleText: string, images: ImageData[]): Promise<string> {
    const prompt = `
      あなたはプロのスポーツニュース編集者です。テキスト記事と分析済みの画像があります。
      これらを最適に統合し、簡潔なマークダウン形式で記事を作成してください。

      【記事本文】
      ${articleText}

      【利用可能な画像】
      ${images
        .map(
          (img, index) => `[画像${index + 1}] ID: ${img.id}
      説明: ${img.analysis || "説明なし"}
      URL: ${img.url}
      `
        )
        .join("\n\n")}

      【出力形式の制限】
      以下のマークダウン要素のみを使用してください：
      1. タイトル: # タイトル
      2. 見出し: ## 見出し
      3. サブ見出し: ### サブ見出し
      4. 本文: 通常のテキスト（シンプルに記述）
      5. 画像: ![代替テキスト](画像URL)
      6. 画像キャプション: *キャプション* (画像の直後に配置)
      7. 太字: **太字テキスト**
      8. リンク: [テキスト](URL)

      【以下の要素は使用禁止】
      - リスト（箇条書きや番号付きリスト）
      - コードブロック
      - 水平線
      - 斜体（画像キャプションを除く）
      - インラインコード
      - HTMLタグ（figcaptionなど）

      元の記事の内容を尊重しながら、読みやすく整理された形式で再構成してください。段落は簡潔にまとめ、重要な情報に焦点を当ててください。
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
