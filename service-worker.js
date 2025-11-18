const CACHE="arbraska-v1";
const FILES=["./","./index.html","./styles.css","./app.js","./manifest.json","./arbraska-logo.png","./icon-192.png","./icon-512.png","./splash.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.map(x=>x!==CACHE&&caches.delete(x))))));
self.addEventListener("fetch",e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));