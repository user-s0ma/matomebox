import type { Route } from "./+types/root";
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, Link } from "react-router";
import { BookOpenText } from "lucide-react";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

const DEFAULT_TITLE = "DeepResearch - AIを活用した自動リサーチツール";
const DEFAULT_DESCRIPTION = "トピックを入力するだけで、AIが自動的に情報を収集・分析し、高品質な記事を生成します。";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{DEFAULT_TITLE}</title>
        <meta name="description" content={DEFAULT_DESCRIPTION} />
        <meta property="og:title" content={DEFAULT_TITLE} />
        <meta property="og:description" content={DEFAULT_DESCRIPTION} />
        <Meta />
        <Links />
      </head>
      <body className="bg-stone-800 text-white min-h-full flex flex-col font-sans">
        <header className="bg-stone-800 border-b border-stone-500 py-4 px-4">
          <div className="mx-auto flex justify-between items-center">
            <Link to="/" className="flex items-center space-x-2">
              <BookOpenText size={24} color="oklch(47.3% 0.137 46.201)" />
              <h1 className="text-xl font-bold">DeepResearch</h1>
            </Link>
          </div>
        </header>
        <main>{children}</main>
        <footer className="bg-stone-800 border-t border-stone-500 p-4 mt-auto">
          <div className="mx-auto text-center">
            <div className="mb-2 flex items-center justify-center space-x-1">
              <BookOpenText size={20} color="oklch(47.3% 0.137 46.201)" />
              <span className="text-xs">DeepResearch</span>
            </div>
            <div className="text-xs text-stone-500">© {new Date().getFullYear()} DeepResearch</div>
          </div>
        </footer>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details = error.status === 404 ? "The requested page could not be found." : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto text-stone-300">
      <h1 className="text-stone-100 text-xl mb-4 font-bold">{message}</h1>
      <p className="mb-4">{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto bg-stone-800 border border-stone-600 rounded-xl text-stone-300 text-sm">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
