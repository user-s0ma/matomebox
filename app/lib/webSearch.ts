import puppeteer, { Browser, Page } from "@cloudflare/puppeteer";
import { env } from "cloudflare:workers";

export type SearchResult = {
  title: string;
  description: string;
  url: string;
  markdown: string;
  links: Array<string>;
  images: Array<{
    id: string;
    url: string;
    alt: string;
    width?: number;
    height?: number;
    position?: number;
    context?: string;
  }>;
};

export class ResearchBrowser {
  private browser: Browser | null = null;

  async getActiveBrowser(): Promise<Browser> {
    if (!this.browser || !(await this.isConnected())) {
      this.browser = await this.launchBrowser();
    }
    return this.browser;
  }

  private async isConnected(): Promise<boolean> {
    if (!this.browser) return false;
    try {
      await this.browser.version();
      return true;
    } catch (e) {
      console.log(e);
      return false;
    }
  }

  private async launchBrowser(): Promise<Browser> {
    return await puppeteer.launch(env.BROWSER, { keep_alive: 600000 });
  }

  async close() {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        console.log("ブラウザを閉じる際にエラーが発生しました：", error);
      }
      this.browser = null;
    }
  }
}

export async function getBrowser(): Promise<ResearchBrowser> {
  return new ResearchBrowser();
}

async function performSearch(page: Page, query: string, limit: number): Promise<string[]> {
  const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
  console.log(`📄 コンテンツ抽出開始: ${searchUrl}`);
  await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('article[data-testid="result"] a[data-testid="result-title-a"]', { timeout: 10000 });

  const urls = await page.evaluate((max) => {
    const anchors = Array.from(document.querySelectorAll('article[data-testid="result"] a[data-testid="result-title-a"]'));
    return anchors
      .map((a) => (a as HTMLAnchorElement).href)
      .filter((h) => h.startsWith("http"))
      .slice(0, max);
  }, limit);

  console.log(`📋 抽出されたURL (${urls.length}件):`, urls);
  return urls;
}

async function extractContent(page: Page, url: string): Promise<SearchResult> {
  console.log(`📄 コンテンツ抽出開始: ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  console.log("✅ ページの読み込みが完了しました");

  await page.evaluate(() => {
    const closeButtons = Array.from(document.querySelectorAll("button, a, div[role='button']")).filter((el) => {
      const text = (el as HTMLElement).innerText.toLowerCase();
      return (
        text.includes("close") ||
        text.includes("×") ||
        text.includes("accept") ||
        text.includes("agree") ||
        text.includes("got it") ||
        text.includes("i understand")
      );
    });

    closeButtons.forEach((btn) => (btn as HTMLElement).click());
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log("📝 ページコンテンツを抽出中...");
  const { title, description, content, links, images } = await page.evaluate(() => {
    const pageTitle = document.title || "タイトルなし";

    const metaDescription = document.querySelector('meta[name="description"]');
    const descriptionText = metaDescription ? metaDescription.getAttribute("content") || "説明なし" : "説明なし";

    const body = document.body.cloneNode(true) as HTMLElement;

    const unwantedSelectors = [
      "script",
      "style",
      "svg",
      "iframe",
      "nav",
      "header",
      "footer",
      "form",
      "noscript",
      "[aria-hidden='true']",
      ".ad",
      ".ads",
      ".advertisement",
      ".cookie-banner",
      "#cookie-notice",
      ".gdpr",
      ".consent",
      ".popup",
    ];

    unwantedSelectors.forEach((selector) => {
      body.querySelectorAll(selector).forEach((el) => el.remove());
    });

    let contentElement = body;

    const contentSelectors = ["main", "article", ".content", ".post", ".article", ".post-content", "[role='main']", "#content", "#main"];

    for (const selector of contentSelectors) {
      const found = body.querySelector(selector);
      if (found && found.textContent && found.textContent.length > 500) {
        contentElement = found as HTMLElement;
        break;
      }
    }

    const imageElements = Array.from(body.querySelectorAll("img"));
    const images = imageElements
      .filter((img) => {
        if (!img.src || img.src.startsWith("data:") || img.src.includes("base64")) {
          return false;
        }

        if (img.src.startsWith("/") || img.src.startsWith("./") || img.src.startsWith("../")) {
          try {
            const baseUrl = new URL(document.location.href);
            img.src = new URL(img.src, baseUrl.origin).href;
          } catch (e) {
            return false;
          }
        }

        if (!img.src.startsWith("http://") && !img.src.startsWith("https://")) {
          return false;
        }

        const width = parseInt(img.getAttribute("width") || "0");
        const height = parseInt(img.getAttribute("height") || "0");
        if ((width > 0 && width < 200) || (height > 0 && height < 200)) {
          return false;
        }

        return true;
      })
      .slice(0, 5)
      .map((img, index) => {
        const position = img.getBoundingClientRect().top;

        let context = "";
        const parent = img.parentElement;
        if (parent) {
          let prevNode = parent.previousElementSibling;
          if (prevNode && prevNode.textContent) {
            context += prevNode.textContent.trim() + " ";
          }

          if (parent.textContent) {
            context += parent.textContent.trim() + " ";
          }

          let nextNode = parent.nextElementSibling;
          if (nextNode && nextNode.textContent) {
            context += nextNode.textContent.trim();
          }
        }

        return {
          id: `img-${index}-${Date.now()}`,
          url: img.src,
          alt: img.alt || "",
          width: img.width || 0,
          height: img.height || 0,
          position: position,
          context: context.substring(0, 400),
        };
      });

    const allLinks = Array.from(document.querySelectorAll("a"))
      .map((a) => a.href)
      .filter((href) => href && href.startsWith("http"));

    return {
      title: pageTitle,
      description: descriptionText,
      content: contentElement.innerHTML || "コンテンツなし",
      links: allLinks,
      images: images,
    };
  });

  console.log(`📊 抽出結果:
      タイトル: ${title}
      説明: ${description.substring(0, 100)}${description.length > 100 ? "..." : ""}
      リンク数: ${links.length}件
      画像数: ${images.length}件
      コンテンツサイズ: ${content.length}文字`);

  function htmlToMarkdown(html: string, images: any[]): string {
    let processedHtml = html;

    const sortedImages = [...images].sort((a, b) => (a.position || 0) - (b.position || 0));

    sortedImages.forEach((img) => {
      const escapedUrl = img.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const imgRegex = new RegExp(`<img[^>]*src=["']${escapedUrl}["'][^>]*>`, "g");
      processedHtml = processedHtml.replace(imgRegex, `[IMAGE_PLACEHOLDER_${img.id}]`);
    });

    let markdown = processedHtml
      .replace(/<\/?[^>]+(>|$)/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\s{50,}/g, "\n\n")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .trim();

    return markdown;
  }

  const markdown = htmlToMarkdown(content, images);

  return { title, description, url, markdown, links, images };
}

export async function webSearch(browser: Browser, query: string, limit = 5): Promise<SearchResult[]> {
  console.log(`🔍 検索開始: "${query}" (最大${limit}件の結果)`);
  const startTime = Date.now();

  let urls: string[];
  {
    const page = await browser.newPage();
    try {
      urls = await performSearch(page, query, limit);
    } finally {
      await page.close();
    }
  }
  console.log(`⏱️ 検索完了（${Date.now() - startTime}ms）: ${urls.length} 件`);

  const results: SearchResult[] = [];
  for (const url of urls) {
    let page;
    try {
      page = await browser.newPage();
      const res = await extractContent(page, url);
      results.push(res);
    } catch (error) {
      console.error(`❌ 抽出エラー（${url}）:`, error);
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (error) {
          console.log("ページを閉じる際にエラーが発生しました：", error);
        }
      }
    }
  }

  return results;
}
