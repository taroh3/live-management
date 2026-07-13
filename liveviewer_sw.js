/**
 * liveviewer_sw.js
 * ライブビューワー Service Worker
 * Ver 1.4.0
 *
 * 変更履歴：
 * v1.4.0 - Ver2.4 データ取得改善（3段階フォールバック・並列取得・取得中表示・再試行・
 *          統計鮮度・更新ボタン改善）に伴うHTML改訂のためキャッシュ名をv10に更新
 * v1.3.0 - Phase 1仕上げ: 障害復旧機構（修復ボタン・reset.html等）の追加に伴うHTML改訂のため
 *          キャッシュ名をv9に更新
 * v1.2.0 - Phase 1: キャッシュ名をv8に更新／STATIC_ASSETSの旧ファイル名(liveviewer006.html)を是正／
 *          HTML本体をネットワーク優先＋オフライン時キャッシュフォールバックに変更
 * v1.1.0 - GAS APIリクエストをキャッシュしないように変更
 * v1.0.0 - 初版作成
 */

var CACHE_NAME    = 'liveviewer-v10';
var STATIC_ASSETS = [
  './',
  './liveviewer.html',
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

  // HTML本体（ナビゲーション／.html）はネットワーク優先＋オフライン時キャッシュフォールバック
  // （CACHE_NAME更新忘れでHTML更新が恒久的に反映されない構造を解消）
  var isHtml = e.request.mode === 'navigate' ||
               url.pathname === '/' ||
               url.pathname.endsWith('.html');
  if (isHtml) {
    e.respondWith(
      fetch(e.request).then(function(res) {
        var clone = res.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, clone); });
        return res;
      }).catch(function() {
        return caches.match(e.request).then(function(cached) {
          return cached || caches.match('./liveviewer.html');
        });
      })
    );
    return;
  }

  // その他の静的ファイルはキャッシュファースト
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
