import puppeteer, { Browser } from "@cloudflare/puppeteer";
import { env } from "cloudflare:workers";

export type SearchResult = {
  title: string;
  description: string;
  url: string;
  markdown: string;
  links: Array<string>;
  images: Array<{
    url: string;
    alt: string;
    width?: number;
    height?: number;
  }>;
};

type Env = {
  AI: Ai;
  BROWSER: Fetcher;
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
    return await puppeteer.launch((env as Env).BROWSER, { keep_alive: 600000 });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export async function getBrowser(): Promise<ResearchBrowser> {
  return new ResearchBrowser();
}

async function performSearch(browser: Browser, query: string, limit: number): Promise<string[]> {
  const page = await browser.newPage();
  try {
    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
    console.log(`📄 コンテンツ抽出開始: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
    console.log("✅ ページの読み込みが完了しました");

    await page.waitForSelector('article[data-testid="result"] a[data-testid="result-title-a"]', {
      timeout: 10000,
    });

    const urls = await page.evaluate((max) => {
      const anchors = Array.from(document.querySelectorAll('article[data-testid="result"] a[data-testid="result-title-a"]'));
      return anchors
        .map((a) => (a as HTMLAnchorElement).href)
        .filter((href) => href.startsWith("http"))
        .slice(0, max);
    }, limit);

    console.log(`📋 抽出されたURL (${urls.length}件):`);
    urls.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));

    return urls;
  } catch (error) {
    console.error(`検索に失敗しました: ${(error as Error).message}`);
    return [];
  } finally {
    await page.close();
  }
}

async function extractContent(browser: Browser, url: string): Promise<SearchResult> {
  console.log(`📄 コンテンツ抽出開始: ${url}`);
  let page;
  try {
    console.log(`🔄 新規ページを作成中...`);
    page = await browser.newPage();
    console.log(`✅ 新規ページの作成に成功しました`);
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
          if ((width > 0 && width < 100) || (height > 0 && height < 100)) {
            return false;
          }

          return true;
        })
        .slice(0, 5) // 最大5枚まで
        .map((img) => ({
          url: img.src,
          alt: img.alt || "",
          width: img.width || 0,
          height: img.height || 0,
        }));

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

    function htmlToMarkdown(html: string): string {
      return html
        .replace(/<\/?[^>]+(>|$)/g, " ")
        .replace(/\s+/g, " ")
        .replace(/\s{50,}/g, "\n\n")
        .replace(/&nbsp;/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .trim();
    }

    return {
      title,
      description,
      url,
      markdown: htmlToMarkdown(content),
      links,
      images,
    };
  } catch (error) {
    console.error(`コンテンツ抽出に失敗しました (${url}): ${(error as Error).message}`);

    return {
      title: "読み込みエラー",
      description: `ページの読み込みに失敗しました: ${(error as Error).message}`,
      url,
      markdown: "コンテンツの抽出に失敗しました",
      links: [],
      images: [],
    };
  } finally {
    if (page) {
      await page.close();
    }
  }
}

export async function webSearch(browser: Browser, query: string, limit = 5): Promise<SearchResult[]> {
  console.log(`🔍 検索開始: "${query}" (最大${limit}件の結果)`);
  const startTime = Date.now();
  const urls = await performSearch(browser, query, limit);
  console.log(`⏱️ 検索完了: ${Date.now() - startTime}ms`);

  const promises = urls.map((url) => extractContent(browser, url));

  try {
    return await Promise.all(promises);
  } catch (error) {
    console.error("検索結果の処理中にエラーが発生しました:", error);

    const results = await Promise.allSettled(promises);
    return results.filter((result): result is PromiseFulfilledResult<SearchResult> => result.status === "fulfilled").map((result) => result.value);
  }
}
