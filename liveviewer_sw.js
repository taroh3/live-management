/**
 * liveviewer_sw.js
 * ライブビューワー Service Worker
 * Ver 1.0.0
 *
 * 処理内容：
 * オフライン対応のためのService Worker。
 * 最後にオンラインで取得したデータをキャッシュして
 * オフライン時でも閲覧できるようにする。
 */

const CACHE_NAME    = 'liveviewer-v1';
const OFFLINE_KEY   = 'lv_offline_data';
const STATIC_ASSETS = [
  './',
  './liveviewer.html',
];

// ============================================================
// インストール
// ============================================================
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ============================================================
// アクティベート
// ============================================================
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ============================================================
// フェッチ（キャッシュファースト戦略）
// ============================================================
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // GAS WebApp APIリクエストはネットワークファースト
  if (url.pathname.includes('/macros/s/') || url.searchParams.has('action')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // 成功したらキャッシュに保存
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return res;
        })
        .catch(() => {
          // オフライン時はキャッシュから返す
          return caches.match(e.request).then(cached => {
            if (cached) return cached;
            return new Response(
              JSON.stringify({ success: false, offline: true, error: 'オフラインです' }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // 静的ファイルはキャッシュファースト
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return res;
      });
    })
  );
});
