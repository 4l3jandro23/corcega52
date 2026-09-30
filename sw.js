/* Córcega 52 · service worker.
   Cachea SOLO la interfaz (HTML, CSS, JS, iconos, fuente, supabase-js) para que abra al instante.
   Los datos nunca pasan por aquí: las llamadas a Supabase van siempre a la red.
   Al cambiar cualquier archivo, sube la versión para que los móviles cojan lo nuevo. */
var VERSION = "c52-v5";
var SHELL = [
  "./", "index.html", "styles.css", "config.js", "rotation.js", "db.js", "app.js", "manifest.json",
  "icons/icon.svg", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js"
];

self.addEventListener("install", function(e){
  e.waitUntil(caches.open(VERSION).then(function(c){ return c.addAll(SHELL); }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k!==VERSION; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

function cacheable(url){
  return url.origin===self.location.origin
      || url.hostname==="cdn.jsdelivr.net"
      || url.hostname==="fonts.googleapis.com"
      || url.hostname==="fonts.gstatic.com";
}

// Stale-while-revalidate: responde con lo cacheado y actualiza por detrás
self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method!=="GET") return;
  var url = new URL(req.url);
  if(!cacheable(url)) return;                       // Supabase (API y Realtime) → red, sin tocar
  var isNav = req.mode==="navigate";
  // config.js: red primero, para que al rellenarlo se note a la primera
  if(url.origin===self.location.origin && /\/config\.js$/.test(url.pathname)){
    e.respondWith(fetch(req).then(function(res){
      if(res.ok){ var copy=res.clone(); caches.open(VERSION).then(function(c){ c.put(req, copy); }); }
      return res;
    }).catch(function(){ return caches.match(req, {ignoreSearch:true}); }));
    return;
  }
  e.respondWith(caches.open(VERSION).then(function(cache){
    var key = isNav ? "./" : req;
    return cache.match(key, {ignoreSearch:isNav}).then(function(hit){
      var net = fetch(req).then(function(res){
        if(res && (res.ok || res.type==="opaque")) cache.put(key, res.clone());
        return res;
      }).catch(function(){ return hit; });
      if(hit){ e.waitUntil(net); return hit; }
      return net;
    });
  }));
});
