import { Outlet, Scripts, ScrollRestoration, Link } from "react-router";
import { BookOpenText } from "lucide-react";
import "@/app.css";

export default function Layout() {
  return (
    <body className="bg-stone-800 text-white min-h-full flex flex-col font-sans">
      <header className="bg-stone-800 border-b border-stone-500 py-4 px-4">
        <div className="mx-auto flex justify-between items-center">
          <Link to="//dash" className="flex items-center space-x-2">
            <BookOpenText size={24} color="oklch(47.3% 0.137 46.201)" />
            <h1 className="text-xl font-bold">まとめボックス</h1>
          </Link>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="bg-stone-800 border-t border-stone-500 p-4 mt-auto">
        <div className="mx-auto text-center">
          <div className="mb-2 flex items-center justify-center space-x-1">
            <BookOpenText size={20} color="oklch(47.3% 0.137 46.201)" />
            <span className="text-xs">まとめボックス</span>
          </div>
          <div className="text-xs text-stone-500">© {new Date().getFullYear()} まとめボックス</div>
        </div>
      </footer>
      <ScrollRestoration />
      <Scripts />
    </body>
  );
}
