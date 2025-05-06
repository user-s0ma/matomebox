import { Outlet, Scripts, ScrollRestoration, Link } from "react-router";
import "@/app.css";

export default function Layout() {
  return (
    <body className="bg-white text-black min-h-dvh flex flex-col font-sans">
      <header className="h-12 bg-white border-b border-stone-500 p-2">
        <div className="mx-auto flex justify-between items-center">
          <Link to="/" className="flex items-center font-bold">
            <span className="text-xl text-stone-500 italic">Deep</span>
            <span className="text-xl font-serif">Nect</span>
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="h-12 w-full flex bg-white border-t border-stone-500 p-2">
        <div className="m-auto text-xs text-stone-500">© {new Date().getFullYear()} DeepNect</div>
      </footer>
      <ScrollRestoration />
      <Scripts />
    </body>
  );
}
