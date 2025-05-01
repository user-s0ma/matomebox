import type { Route } from "./+types/root";
import { isRouteErrorResponse, Links, Meta, Outlet } from "react-router";
import "./app.css";

const DEFAULT_TITLE = "MatomeBox - AIを活用した自動リサーチツール";
const DEFAULT_DESCRIPTION = "トピックを入力するだけで、AIが自動的に情報を収集・分析し、高品質な記事を生成します。";

export default function App() {
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
      <Outlet />
    </html>
  );
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
