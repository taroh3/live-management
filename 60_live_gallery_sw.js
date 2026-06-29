// 60_live_gallery_sw.js
// たろうのLive Gallery Service Worker
// v6.0.0
//
// 変更履歴：
// v6.0.0 - 年選択時に年始の公演を表示
// v5.0.0 - ポスター長押しライトボックス追加
// v4.0.0 - アーティスト写真を上詰め表示に変更
// v3.0.0 - 写真ファイル名のID形式統一に伴うキャッシュ更新
// v2.0.0 - キャッシュ名をv2に更新・対象HTMLを60_live_gallery.htmlに修正
// v1.0.0 - 初版作成

var CACHE_NAME    = 'live-gallery-v6';
var STATIC_ASSETS = [
  './',
  './60_live_gallery.html',
];

// インストール
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// アクティベート
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// フェッチ
self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);

  // GAS WebApp APIリクエストは常にネットワークから取得（キャッシュしない）
  if (url.pathname.includes('/macros/s/') || url.searchParams.has('action')) {
    e.respondWith(
      fetch(e.request).catch(function() {
        return new Response(
          JSON.stringify({ success: false, offline: true, error: 'オフラインです' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // 静的ファイルはキャッシュファースト
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(res) {
        var clone = res.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, clone); });
        return res;
      });
    })
  );
});
