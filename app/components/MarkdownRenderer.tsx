import React from "react";

type MarkdownRendererProps = {
  markdown: string;
  images?: Array<{
    url: string;
    alt?: string;
    analysis?: string;
  }>;
};

export function MarkdownRenderer({ markdown, images = [] }: MarkdownRendererProps) {
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
    let inCodeBlock = false;
    let codeContent = "";
    let codeLanguage = "";
    let listItems: string[] = [];
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // コードブロック
      if (line.startsWith("```")) {
        if (inCodeBlock) {
          result.push(
            <pre key={`code-${i}`} className="bg-gray-100 p-4 rounded overflow-auto">
              <code className={codeLanguage ? `language-${codeLanguage}` : ""}>{codeContent}</code>
            </pre>
          );
          inCodeBlock = false;
          codeContent = "";
          codeLanguage = "";
        } else {
          inCodeBlock = true;
          codeLanguage = line.slice(3).trim();
          if (currentParagraph.length > 0) {
            result.push(
              <p key={`p-${i}`} className="mb-4">
                {parseInline(currentParagraph.join(" "))}
              </p>
            );
            currentParagraph = [];
          }
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent += line + "\n";
        continue;
      }

      // 見出し
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
          <h1 key={`h1-${i}`} className="text-3xl font-bold mt-6 mb-4">
            {parseInline(line.slice(2))}
          </h1>
        );
        continue;
      }
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
          <h2 key={`h2-${i}`} className="text-2xl font-bold mt-6 mb-3">
            {parseInline(line.slice(3))}
          </h2>
        );
        continue;
      }
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
          <h3 key={`h3-${i}`} className="text-xl font-bold mt-5 mb-2">
            {parseInline(line.slice(4))}
          </h3>
        );
        continue;
      }

      // 水平線
      if (line.startsWith("---") || line.startsWith("***") || line.startsWith("___")) {
        if (currentParagraph.length > 0) {
          result.push(
            <p key={`p-${i}`} className="mb-4">
              {parseInline(currentParagraph.join(" "))}
            </p>
          );
          currentParagraph = [];
        }
        result.push(<hr key={`hr-${i}`} className="my-4 border-t border-gray-300" />);
        continue;
      }

      // リスト
      if (line.match(/^[*-] /)) {
        if (!inList) {
          if (currentParagraph.length > 0) {
            result.push(
              <p key={`p-${i}`} className="mb-4">
                {parseInline(currentParagraph.join(" "))}
              </p>
            );
            currentParagraph = [];
          }
          inList = true;
        }
        listItems.push(line.slice(2));
        continue;
      } else if (inList && line.trim() === "") {
        result.push(
          <ul key={`ul-${i}`} className="list-disc pl-6 mb-4">
            {listItems.map((item, idx) => (
              <li key={`li-${idx}`} className="mb-1">
                {parseInline(item)}
              </li>
            ))}
          </ul>
        );
        listItems = [];
        inList = false;
        continue;
      }

      // 番号付きリスト
      if (line.match(/^\d+\. /)) {
        if (!inList) {
          if (currentParagraph.length > 0) {
            result.push(
              <p key={`p-${i}`} className="mb-4">
                {parseInline(currentParagraph.join(" "))}
              </p>
            );
            currentParagraph = [];
          }
          inList = true;
        }
        const content = line.replace(/^\d+\. /, "");
        listItems.push(content);
        continue;
      }

      // 画像
      const imageMatch = line.match(/!\[(.*?)\]\((.*?)\)/);
      if (imageMatch) {
        if (currentParagraph.length > 0) {
          result.push(
            <p key={`p-${i}`} className="mb-4">
              {parseInline(currentParagraph.join(" "))}
            </p>
          );
          currentParagraph = [];
        }

        const alt = imageMatch[1] || "";
        const src = imageMatch[2] || "";

        const nextLine = i + 1 < lines.length ? lines[i + 1] : "";
        let caption = "";

        if (nextLine.startsWith("*") && nextLine.endsWith("*")) {
          caption = nextLine.slice(1, -1);
          i++;
        }

        result.push(
          <figure key={`img-${i}`} className="my-6">
            <img src={src} alt={alt} className="mx-auto rounded-lg max-w-full" />
            {caption && <figcaption className="text-center text-sm text-gray-600 mt-2">{caption}</figcaption>}
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

    if (inList && listItems.length > 0) {
      result.push(
        <ul key="last-ul" className="list-disc pl-6 mb-4">
          {listItems.map((item, idx) => (
            <li key={`last-li-${idx}`} className="mb-1">
              {parseInline(item)}
            </li>
          ))}
        </ul>
      );
    }

    return result;
  }

  function parseInline(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let currentText = "";

    const regex = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3|(`)(.*?)\5|(\[)(.*?)(\]\((.*?)\))/g;
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
        parts.push(<strong key={`strong-${match.index}`}>{match[2]}</strong>);
      } else if (match[3]) {
        // 斜体 (*text* or _text_)
        parts.push(currentText);
        currentText = "";
        parts.push(<em key={`em-${match.index}`}>{match[4]}</em>);
      } else if (match[5]) {
        // インラインコード (`text`)
        parts.push(currentText);
        currentText = "";
        parts.push(
          <code key={`code-${match.index}`} className="bg-gray-100 px-1 rounded">
            {match[6]}
          </code>
        );
      } else if (match[7]) {
        // リンク ([text](url))
        parts.push(currentText);
        currentText = "";
        parts.push(
          <a key={`link-${match.index}`} href={match[10]} className="text-blue-600 hover:underline">
            {match[8]}
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

  return <div className="markdown-content">{parseMarkdown(processedMarkdown)}</div>;
}
