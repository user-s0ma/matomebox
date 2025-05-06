import { Outlet, Scripts, ScrollRestoration, Link } from "react-router";
import "@/app.css";

export default function Layout() {
  return (
    <body className="bg-white text-black min-h-dvh flex flex-col font-sans">
      <Outlet />
      <footer className="h-12 w-full flex bg-white border-t border-stone-500 p-2">
        <div className="m-auto text-xs text-stone-500">© {new Date().getFullYear()} DeepNect</div>
      </footer>
      <ScrollRestoration />
      <Scripts />
    </body>
  );
}
