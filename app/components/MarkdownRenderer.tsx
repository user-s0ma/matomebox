import React from "react";

export function MarkdownRenderer({
  markdown,
  images = [],
}: {
  markdown: string;
  images?: Array<{
    url: string;
    alt: string | null;
    analysis: string | null;
    sourceUrl?: string;
  }>;
}) {
  const processedMarkdown = markdown.replace(/\[(.*?)画像(\d+)(.*?)\]/g, (match, prefix, numStr, suffix) => {
    const index = parseInt(numStr) - 1;
    if (index < 0 || index >= images.length) return match;
    const img = images[index];
    return `\n\n![${img.alt || `関連画像 ${index + 1}`}](${img.url})\n\n`;
  });

  function parseMarkdown(text: string): React.ReactNode[] {
    const lines = text.split("\n");
    const result: React.ReactNode[] = [];
    let currentParagraph: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // タイトル (h1)
      if (line.startsWith("# ")) {
        if (currentParagraph.length > 0) {
          result.push(
            <p key={`p-${i}`} className="mb-4">
              {parseInline(currentParagraph.join(" "))}
            </p>
          );
          currentParagraph = [];
        }
        result.push(
          <h1 key={`h1-${i}`} className="text-3xl font-bold my-4">
            {parseInline(line.slice(2))}
          </h1>
        );
        continue;
      }

      // 見出し (h2)
      if (line.startsWith("## ")) {
        if (currentParagraph.length > 0) {
          result.push(
            <p key={`p-${i}`} className="mb-4">
              {parseInline(currentParagraph.join(" "))}
            </p>
          );
          currentParagraph = [];
        }
        result.push(
          <h2 key={`h2-${i}`} className="text-2xl font-bold my-3">
            {parseInline(line.slice(3))}
          </h2>
        );
        continue;
      }

      // サブ見出し (h3)
      if (line.startsWith("### ")) {
        if (currentParagraph.length > 0) {
          result.push(
            <p key={`p-${i}`} className="mb-4">
              {parseInline(currentParagraph.join(" "))}
            </p>
          );
          currentParagraph = [];
        }
        result.push(
          <h3 key={`h3-${i}`} className="text-xl font-bold my-2">
            {parseInline(line.slice(4))}
          </h3>
        );
        continue;
      }

      // 画像
      const imageMatch = line.match(/!\[(.*?)\]\(([^\s\)]+)\)/);
      if (imageMatch) {
        if (currentParagraph.length > 0) {
          result.push(
            <p key={`p-${i}`} className="mb-4 text-stone-300">
              {parseInline(currentParagraph.join(" "))}
            </p>
          );
          currentParagraph = [];
        }

        const alt = imageMatch[1] || "";
        const src = imageMatch[2] || "";

        const imageIndex = images.findIndex((img) => img.url === src);
        const imageData = imageIndex >= 0 ? images[imageIndex] : null;

        const nextLine = i + 1 < lines.length ? lines[i + 1] : "";
        let caption = "";
        let sourceUrl = "";

        if (nextLine.startsWith("*") && nextLine.endsWith("*")) {
          const fullCaption = nextLine.slice(1, -1);

          const sourceMatch = fullCaption.match(/(.*?)（出典:\s*(https?:\/\/[^\s)]+)）$/);

          if (sourceMatch) {
            caption = sourceMatch[1].trim();
            sourceUrl = sourceMatch[2].trim();
          } else {
            caption = fullCaption;
          }

          i++;
        }

        result.push(
          <figure key={`img-${i}`} className="my-6">
            <img src={src} alt={alt} className="mx-auto rounded-xl border border-stone-500 max-w-full" style={{ maxHeight: 500 }} />
            {!!caption && (
              <figcaption className="text-center text-xs mt-2">
                <span className="text-stone-400">{caption}</span>
                {!!sourceUrl && (
                  <>
                    <span className="text-stone-500 mx-1"> ・ 出典: </span>
                    <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-xs">
                      {new URL(sourceUrl).hostname}
                    </a>
                  </>
                )}
              </figcaption>
            )}
          </figure>
        );
        continue;
      }

      // 空行
      if (line.trim() === "") {
        if (currentParagraph.length > 0) {
          result.push(
            <p key={`p-${i}`} className="mb-4">
              {parseInline(currentParagraph.join(" "))}
            </p>
          );
          currentParagraph = [];
        }
        continue;
      }

      // 通常のテキスト行
      currentParagraph.push(line);
    }

    if (currentParagraph.length > 0) {
      result.push(
        <p key="last-p" className="mb-4">
          {parseInline(currentParagraph.join(" "))}
        </p>
      );
    }

    return result;
  }

  function parseInline(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let currentText = "";

    const regex = /(\*\*|__)(.*?)\1|(\[)(.*?)(\]\(([^\s\)]+)\))/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        currentText += text.slice(lastIndex, match.index);
      }

      if (match[1]) {
        // 太字 (**text** or __text__)
        parts.push(currentText);
        currentText = "";
        parts.push(
          <strong key={`strong-${match.index}`} className="font-bold">
            {match[2]}
          </strong>
        );
      } else if (match[3]) {
        // リンク ([text](url))
        parts.push(currentText);
        currentText = "";
        parts.push(
          <a key={`link-${match.index}`} href={match[6]} className="text-blue-500 hover:underline hover:text-amber-500">
            {match[4]}
          </a>
        );
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      currentText += text.slice(lastIndex);
    }

    if (currentText) {
      parts.push(currentText);
    }

    return parts;
  }

  return <div className="markdown-content wrap-anywhere">{parseMarkdown(processedMarkdown)}</div>;
}
