import { Outlet, Scripts, ScrollRestoration, Link } from "react-router";
import { BookOpenText } from "lucide-react";
import "@/app.css";

export default function Layout() {
  return (
    <body className="bg-stone-800 text-white min-h-dvh flex flex-col font-sans">
      <header className="h-12 bg-stone-800 border-b border-stone-500 p-2">
        <div className="mx-auto flex justify-between items-center">
          <Link to="/" className="flex items-center font-bold">
            <span className="text-xl">NECT</span>
            <span className="text-xl text-stone-500 italic">ニュース</span>
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="h-12 w-full flex bg-stone-800 border-t border-stone-500 p-2">
        <div className="m-auto text-xs text-stone-500">© {new Date().getFullYear()} NECTニュース</div>
      </footer>
      <ScrollRestoration />
      <Scripts />
    </body>
  );
}
