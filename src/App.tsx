import { useEffect, useState } from "react";
import { ToastProvider } from "./toast";
import { keyLockState } from "./api";
import UnlockGate from "./components/UnlockGate";
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
  // 本地模式：Key 已加密保存且未解锁时，先显示解锁门
  const [locked, setLocked] = useState(() => keyLockState() === "locked");

  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  if (locked) {
    return <UnlockGate onUnlocked={() => setLocked(false)} />;
  }

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
