import { Outlet, Scripts, ScrollRestoration, Link, NavLink } from "react-router";
import "@/app.css";

const categories = ["国内", "国際", "経済", "エンタメ", "スポーツ", "IT", "ライフ", "その他"];

export default function Layout() {
  return (
    <body className="bg-stone-200 text-black min-h-dvh flex flex-col font-sans">
      <header className="h-12 bg-stone-200 border-b border-stone-500 p-2">
        <div className="mx-auto flex justify-between items-center">
          <Link to="/" className="flex items-center font-bold">
            <span className="text-xl">NECT</span>
            <span className="text-xl text-stone-500 italic">ニュース</span>
          </Link>
          <Link to="/dash" className="text-white bg-amber-700 py-1 px-2 rounded-xl">
            ダッシュボード
          </Link>
        </div>
      </header>
      <nav className="flex min-w-full bg-amber-700 overflow-x-auto overflow-y-hidden">
        <ul className="flex space-x-1 pt-2">
          <li className="flex">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `whitespace-nowrap px-4 py-2 rounded-t-xl ${isActive ? "bg-stone-200 text-amber-700" : "bg-white/50 text-white"}`
              }
            >
              トップ
            </NavLink>
          </li>
          {categories.map((category) => (
            <li key={category} className="flex">
              <NavLink
                to={`/${category}`}
                className={({ isActive }) =>
                  `whitespace-nowrap px-4 py-2 rounded-t-xl ${isActive ? "bg-stone-200 text-amber-700" : "bg-white/50 text-white"}`
                }
              >
                {category}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="h-12 w-full flex bg-stone-200 border-t border-stone-500 p-2">
        <div className="m-auto text-xs text-stone-500">© {new Date().getFullYear()} NECTニュース</div>
      </footer>
      <ScrollRestoration />
      <Scripts />
    </body>
  );
}
