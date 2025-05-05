import { Outlet, Scripts, ScrollRestoration, Link } from "react-router";
import { BookOpenText } from "lucide-react";
import "@/app.css";

export default function Layout() {
  return (
    <body className="bg-stone-800 text-white min-h-dvh flex flex-col font-sans">
      <header className="h-12 bg-stone-800 border-b border-stone-500 p-2">
        <div className="mx-auto flex justify-between items-center">
          <Link to="/" className="flex items-center space-x-2">
            <BookOpenText size={24} color="oklch(47.3% 0.137 46.201)" />
            <h1 className="text-xl font-bold">Nectニュース</h1>
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="h-12 bg-stone-800 border-t border-stone-500 p-4 mt-auto">
        <div className="mx-auto text-center">
          <div className="mb-2 flex items-center justify-center space-x-1">
            <BookOpenText size={20} color="oklch(47.3% 0.137 46.201)" />
            <span className="text-xs">Nectニュース</span>
          </div>
          <div className="text-xs text-stone-500">© {new Date().getFullYear()} Nectニュース</div>
        </div>
      </footer>
      <ScrollRestoration />
      <Scripts />
    </body>
  );
}
