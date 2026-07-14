/**
 * liveviewer_sw.js
 * ライブビューワー Service Worker
 * Ver 1.18.0
 *
 * 変更履歴：
 * v1.18.0 - 演者一覧・中間一覧でフィルターバー非表示時の上余白(36px)を詰める／演者名上余白8px／
 *          ワンマンを柿色／演者一覧の演者名17px。キャッシュ名をv24に更新
 * v1.17.0 - 中間一覧・演者一覧の見た目調整（余白ゼロ化・行間短縮・演者名レモン色・ワンマン赤字・
 *          演者一覧の演者名+2px）。キャッシュ名をv23に更新
 * v1.16.0 - 中間一覧・演者一覧の余白微調整（年タブ上の余白短縮／演者名と参戦本数の行間0／
 *          演者一覧の行間短縮）＋対バン表記の是正。キャッシュ名をv22に更新
 * v1.15.0 - 中間一覧の仕様変更: 年タブ追加／ヘッダーを演者名＋参戦本数(右寄せ)の2段に／
 *          フォント調整・行間短縮・対バン表記から「対バン」を削除。キャッシュ名をv21に更新
 * v1.14.0 - Ver2.8中間一覧の修正: スクロール不能を修正／演者名・参戦本数・日付のフォント拡大／
 *          日付をYYYY/MM/DD(曜)表記（半角カッコ）に変更。キャッシュ名をv20に更新
 * v1.13.0 - Ver2.8（演者別公演一覧＝中間一覧）を新設。演者名タップで1公演1行のリストを挟み、
 *          行タップでカードへ。HTML改訂のためキャッシュ名をv19に更新
 * v1.12.0 - Ver2.7（公演カードに公演名・形式を表示／公演情報フォームに公演名入力欄を新設）に伴う
 *          HTML改訂のためキャッシュ名をv18に更新
 * v1.11.0 - バグ⑭（アンコール区分変更で曲順が壊れる）: 編集・削除・追加の直後に曲順を自動追送し、
 *          編集モードのボタン文言を実態に合わせて是正。HTML改訂のためキャッシュ名をv17に更新
 * v1.10.0 - バグ④（再解析の整理）: ビューアー③解析に事前確認ダイアログ＋「写真なし・既存曲あり」の
 *          全消し防止ガードを追加。HTML改訂のためキャッシュ名をv16に更新
 * v1.9.0 - バグ⑦（キャンセル公演の非表示）・③（1バンド無セトリの入力経路＋再読み込み導線）・
 *          ⑬（オフライン復元キーの整合）修正に伴うHTML改訂のためキャッシュ名をv15に更新
 * v1.8.0 - バグ①修正（対バンのセトリ修正で別バンドを掴む誤りを是正／編集中タブ切替ロック）
 *          に伴うHTML改訂のためキャッシュ名をv14に更新
 * v1.7.0 - バグ⑤修正（書き込み対象を操作開始時に確定し、送信時の再解決を全廃／
 *          モーダル中スワイプロック／保存先明示）に伴うHTML改訂のためキャッシュ名をv13に更新
 * v1.6.0 - Phase 2 Part A（アーティスト画像をGitHub Pages直接参照へ移行し、
 *          端末へのbase64保存を廃止）に伴うHTML改訂のためキャッシュ名をv12に更新
 * v1.5.0 - Phase 2 Part B（セトリキャッシュ2MB上限・LRU）に伴うHTML改訂のため
 *          キャッシュ名をv11に更新
 * v1.4.0 - Ver2.4 データ取得改善（3段階フォールバック・並列取得・取得中表示・再試行・
 *          統計鮮度・更新ボタン改善）に伴うHTML改訂のためキャッシュ名をv10に更新
 * v1.3.0 - Phase 1仕上げ: 障害復旧機構（修復ボタン・reset.html等）の追加に伴うHTML改訂のため
 *          キャッシュ名をv9に更新
 * v1.2.0 - Phase 1: キャッシュ名をv8に更新／STATIC_ASSETSの旧ファイル名(liveviewer006.html)を是正／
 *          HTML本体をネットワーク優先＋オフライン時キャッシュフォールバックに変更
 * v1.1.0 - GAS APIリクエストをキャッシュしないように変更
 * v1.0.0 - 初版作成
 */

var CACHE_NAME    = 'liveviewer-v24';
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
