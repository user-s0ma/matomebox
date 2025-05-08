import { Outlet } from "react-router";
import "@/app.css";

export default function Layout() {
  return (
    <>
      <Outlet />
      <footer className="h-12 w-full flex bg-white border-t border-stone-500 p-2">
        <div className="m-auto text-xs text-stone-500">© {new Date().getFullYear()} DeepNect</div>
      </footer>
    </>
  );
}
