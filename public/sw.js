// KnowSelf Service Worker：让 PWA 在手机上可离线打开（AI 调用本身需要联网）
const CACHE = "knowself-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(["./", "./index.html"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) {
    const cache = await caches.open(CACHE);
    cache.put(req, res.clone());
  }
  return res;
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    // 导航离线兜底到应用壳
    const shell = await caches.match("./index.html");
    if (shell) return shell;
    throw new Error("离线且无缓存");
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // AI 接口等跨域请求不拦截
  if (url.pathname.includes("/assets/")) {
    // 带内容哈希的构建产物：缓存优先
    event.respondWith(cacheFirst(req));
    return;
  }
  if (req.mode === "navigate") {
    // 页面导航：网络优先，离线回退缓存
    event.respondWith(networkFirst(req));
    return;
  }
  if (url.pathname.endsWith("manifest.webmanifest") || url.pathname.endsWith("icon.svg")) {
    event.respondWith(cacheFirst(req));
  }
  // 其余同源请求（如服务器模式的 /api）直接放行
});
