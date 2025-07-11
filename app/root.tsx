import type { Route } from "./+types/root";
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import "./app.css";

const DEFAULT_TITLE = "";
const DEFAULT_DESCRIPTION = "";

export default function App() {
  return (
    <html lang="ja">
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
      <body className="bg-white text-black min-h-dvh flex flex-col font-sans">
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "エラー";
  let details = "予期しないエラーが発生しました。";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "エラー";
    details = error.status === 404 ? "このページは存在しません。" : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{DEFAULT_TITLE}</title>
        <meta name="description" content={DEFAULT_DESCRIPTION} />
        <meta property="og:title" content={DEFAULT_TITLE} />
        <meta property="og:description" content={DEFAULT_DESCRIPTION} />
        <Meta />
        <Links />
        <ScrollRestoration />
        <Scripts />
      </head>
      <main className="pt-16 p-4 container mx-auto">
        <h1 className="text-xl mb-4 font-bold">{message}</h1>
        <p className="mb-4">{details}</p>
        {stack && (
          <pre className="w-full p-4 overflow-x-auto bg-white border border-stone-500 rounded-xl text-xs">
            <code>{stack}</code>
          </pre>
        )}
      </main>
    </html>
  );
}
