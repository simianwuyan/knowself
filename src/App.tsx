import { useEffect, useState } from "react";
import { ToastProvider } from "./toast";
import ProjectList from "./components/ProjectList";
import CreateProject from "./components/CreateProject";
import ProjectDetail from "./components/ProjectDetail";
import SettingsPage from "./components/SettingsPage";

type Route =
  | { page: "list" }
  | { page: "new" }
  | { page: "project"; id: string }
  | { page: "settings" };

function parseHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, "");
  if (h.startsWith("project/")) {
    const id = h.slice("project/".length);
    if (id) return { page: "project", id };
  }
  if (h === "new") return { page: "new" };
  if (h === "settings") return { page: "settings" };
  return { page: "list" };
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return (
    <ToastProvider>
      <div className="mx-auto min-h-full max-w-2xl bg-slate-50 text-slate-900 shadow-xl">
        {route.page === "list" && <ProjectList />}
        {route.page === "new" && <CreateProject />}
        {route.page === "project" && <ProjectDetail id={route.id} />}
        {route.page === "settings" && <SettingsPage />}
      </div>
    </ToastProvider>
  );
}
