/* Penny Pincher service worker — network-first so a deploy always wins, cache only as an offline fallback. */
var CACHE = "runway-v6";
var SHELL = ["./", "./index.html", "./js/core.js", "./manifest.json", "./mark.png",
             "./favicon-32.png", "./favicon-64.png", "./apple-touch-icon.png",
             "./icon-192.png", "./icon-512.png"];
var LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var sameOrigin = new URL(req.url).origin === self.location.origin;
  var isLib = req.url.indexOf(LIB) === 0;
  // Never touch Supabase API traffic: a stale cached reply would look like live data.
  if (!sameOrigin && !isLib) return;

  e.respondWith(
    fetch(req)
      .then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (hit) {
          if (hit) return hit;
          return req.mode === "navigate" ? caches.match("./index.html") : Response.error();
        });
      })
  );
});
