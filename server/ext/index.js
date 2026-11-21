// =============================================================
// LadyTube 追加機能 エントリポイント
// 本体 server/index.js が express のアプリを作った直後に require('./ext')(app) で呼び出します。
// すべての追加機能はこのフォルダ配下で完結します。
// =============================================================
const path = require('path');
const express = require('express');

const { db, initSchema, getSetting } = require('./db');
const modelno = require('./modelno');
const rename = require('./rename');
const cover = require('./routes/cover');
const meta = require('./routes/meta');
const search = require('./routes/search');
const tags = require('./routes/tags');
const screenshots = require('./routes/screenshots');
const related = require('./routes/related');
const performers = require('./routes/performers');
const tagrules = require('./routes/tagrules');
const dmm = require('./routes/dmm');
const bookmark = require('./routes/bookmark');
const backup = require('./routes/backup');
const bulk = require('./routes/bulk');
const frame = require('./routes/frame');
const maintenance = require('./routes/maintenance');
const replace = require('./routes/replace');
const makers = require('./routes/makers');
const file = require('./routes/file');
const saved = require('./routes/saved');
const createInject = require('./inject');
const libraryRoutes = require('./routes/library');
const library = require('./library');
const autobackup = require('./autobackup');

// サーバーを動かしている PC からだけ使える API に付ける (LAN の端末からは 403)
const pcOnly = (what) => (req, res, next) => (library.isLocal(req) ? next()
    : res.status(403).json({ error: what + 'は、サーバーを動かしている PC（localhost）からのみ行えます' }));

module.exports = function setupExt(app) {
    // 二重ロード防止
    if (app.__wlext_loaded) return;
    app.__wlext_loaded = true;

    // 0. ライブラリ: 書き込みのガード(切り替え前の画面からの書き込みを拒否)は本家のルートより先に登録する。
    //    使用中ライブラリの DB は本体 server/db.js が library.bootPath() で開いている。
    app.use(libraryRoutes.middleware);

    // 1. 追加テーブルを用意
    initSchema();

    // 1.2 DB の自動バックアップ (1日1回。終わるのを待たない)
    autobackup.run(db);

    // 1.5 個人用モジュール (server/private) があれば読み込む。
    //     配布物・git には含めない前提。存在しなければ何もしない(配布時は no-op)。
    //     ext の HTML 注入(res.send)より前に private のミドルウェアを登録するため、ここで呼ぶ。
    try {
        if (require('fs').existsSync(path.join(__dirname, '..', 'private', 'index.js'))) {
            require('../private')(app);
        }
    } catch (e) { console.error('[LadyTube private] ロードに失敗しました', e); }

    // 1.7 本家の「クリーンアップ」に便乗して ext_* の孤立行も掃除する。
    //     本家 routes.js の cleanupMetadata は screenshots と metadata しか消さないため、
    //     動画ファイルが無くなると ext_* 側だけが hash をキーに残ってしまう。
    //     本家は res.json を db.transaction の中で呼ぶので、ここでの削除も同じ
    //     トランザクションに乗り、後続の VACUUM で領域も回収される。
    app.use((req, res, next) => {
        if (req.method !== 'DELETE' || req.path !== '/api/maintenance/metadata') return next();
        const orig = res.json.bind(res);
        res.json = (body) => {
            try {
                if (res.statusCode < 300 && body && body.success) {
                    const r = maintenance.purgeOrphans();
                    body.ext = r;
                    if (r.total) console.log(`[LadyTube] 参照されていない拡張データ ${r.total}件を削除しました`);
                }
            } catch (e) { console.error('[ext maintenance hook]', e); }
            return orig(body);
        };
        next();
    });

    // 1.8 本家の /api/settings は設定を丸ごと返すので、PC 以外には DMM の API ID を渡さない
    //     (LAN の端末の画面は API ID を使わない。検索はサーバーが行う)
    app.use((req, res, next) => {
        if (req.method !== 'GET' || req.path !== '/api/settings' || library.isLocal(req)) return next();
        const orig = res.json.bind(res);
        res.json = (body) => {
            if (body && typeof body === 'object') { delete body.ext_dmm_api_id; delete body.ext_dmm_affiliate_id; }
            return orig(body);
        };
        next();
    });

    // 2. 拡張 API 用の JSON ボディパーサ (画像アップロードのため大きめ)
    app.use('/ext/api', express.json({ limit: '25mb' }));

    // 2.5 スキャンが終わったら (v3.11.0)
    //   ・品番が空の動画に、ファイル名から品番を入れる (modelno.js。入っている品番は変えない)
    //   ・動画情報の自動取得がオンで DMM の API ID があれば、このスキャンで増えた動画のうち品番があってメーカーが空のものの id を
    //     応答の ext_fetch_ids に入れる (管理画面がそのまま一括取得を始める。SettingsPage.jsx)
    //   本体の /api/scan は DB の同期まで終えてから res.json を返すので、その直前に割り込めば、画面が一覧を読み直す時点で品番が入っている。
    //   増えた動画 = スキャン前の最大の id より後の行 (本体は新しいファイルを INSERT し、消えたファイルの行は最後に消す)
    app.use((req, res, next) => {
        if (req.method !== 'POST' || req.path !== '/api/scan') return next();
        let before = null;
        try { before = db.prepare('SELECT IFNULL(MAX(id), 0) AS m FROM files').get().m; } catch (e) { console.error('[ext scan]', e); }
        const orig = res.json.bind(res);
        res.json = (body) => {
            if (res.statusCode < 300 && body && body.count !== undefined) {
                try {
                    const r = modelno.fillAllMissing();
                    console.log(`[LadyTube] スキャン後の品番設定: ${r.set}件設定 / ${r.nomatch}件は規則に合わず`);
                } catch (e) { console.error('[ext modelno scan]', e); }
                try {
                    if (before !== null && getSetting('ext_dmm_auto_fetch', true) && getSetting('ext_dmm_api_id', '') && getSetting('ext_dmm_affiliate_id', '')) {
                        body.ext_fetch_ids = db.prepare(`SELECT f.id FROM files f JOIN ext_video_meta e ON e.hash = f.hash
                            WHERE f.id > ? AND TRIM(IFNULL(e.model_no,'')) <> '' AND TRIM(IFNULL(e.maker,'')) = '' ORDER BY f.id`).all(before).map(r => r.id);
                    }
                } catch (e) { console.error('[ext scan fetch ids]', e); }
            }
            return orig(body);
        };
        next();
    });
    // ファイル名の変更 (v3.12.0。rename.js)。PC からだけ (動画の削除と同じ)
    //   POST /ext/api/video/:id/rename { name }   名前 (拡張子なし) を指定して変える (動画ページ・リスト表示の⋮)
    //   POST /ext/api/rename/rule { ids, dryRun } ファイル名のルールで変える。dryRun なら変える前と後の一覧だけ
    const renameFail = (res, e) => { if (!e.status) console.error('[ext rename]', e); res.status(e.status || 500).json({ error: e.message }); };
    app.post('/ext/api/video/:id/rename', pcOnly('ファイル名の変更'), (req, res) => {
        try { res.json(rename.renameVideo(req.params.id, (req.body || {}).name)); } catch (e) { renameFail(res, e); }
    });
    app.post('/ext/api/rename/rule', pcOnly('ファイル名の変更'), (req, res) => {
        try { const b = req.body || {}; res.json({ items: b.dryRun ? rename.ruleTargets(b.ids) : rename.applyRule(b.ids) }); } catch (e) { renameFail(res, e); }
    });
    // 選んだ動画に、ファイル名から品番を入れる (一括操作とリスト表示の⋮。ExtVideoMenu.jsx)
    app.post('/ext/api/model-no/bulk', (req, res) => {
        try { res.json(modelno.fillByIds((req.body || {}).ids)); }
        catch (e) { console.error('[ext modelno bulk]', e); res.status(500).json({ error: e.message }); }
    });

    // 3. 拡張 API ルート
    // -- ライブラリ
    app.get('/ext/api/libraries', libraryRoutes.list);
    app.get('/ext/api/libraries/current', libraryRoutes.current);
    app.post('/ext/api/libraries', libraryRoutes.create);
    app.post('/ext/api/libraries/import', libraryRoutes.importDb);
    app.put('/ext/api/libraries/:id', libraryRoutes.rename);
    app.post('/ext/api/libraries/:id/switch', libraryRoutes.switchTo);
    app.delete('/ext/api/libraries/:id', libraryRoutes.remove);
    // LadyTube の終了 (右上のメニュー。v3.11.0)。DB を閉じて終了コード 0 で終わる (ladytube.bat は 0 なら窓を閉じる)。
    // 止め方はライブラリの切り替え (library.js の switchTo) と同じ。スキャン中は断る
    app.post('/ext/api/shutdown', pcOnly('LadyTube の終了'), (req, res) => {
        if (require('../services/scanner').isScanning) return res.status(400).json({ error: 'スキャン中は終了できません。スキャンの完了か中止を待ってください' });
        res.json({ ok: true });
        setTimeout(() => { try { db.close(); } catch (e) { } process.exit(0); }, 400);
    });
    // -- 設定 / カバー画像
    app.get('/ext/api/settings', cover.getSettings);
    app.post('/ext/api/settings', cover.updateSettings);
    app.get('/ext/api/video/:id/cover', cover.getCover);

    // -- 動画ファイルの配信 (モバイルの端末保存 / アプリで開く)
    app.get('/ext/api/video/:id/file', file.file);

    // -- コマ送り (フレームレート)
    app.get('/ext/api/video/:id/frameinfo', frame.frameInfo);

    // -- メンテナンス (参照されていない拡張データ)
    app.get('/ext/api/maintenance/orphans', maintenance.orphans);
    app.post('/ext/api/maintenance/cleanup', maintenance.cleanup);

    // -- メタデータの一括置換 (本家のタグ置換を置き換える)
    app.get('/ext/api/metadata/replace-kinds', replace.kinds);
    app.post('/ext/api/metadata/replace', replace.replace);
    app.post('/ext/api/metadata/delete', replace.remove);

    // -- DMM(FANZA) 商品検索 / メーカー検索
    app.get('/ext/api/dmm/search', dmm.search);
    app.post('/ext/api/dmm/apply', dmm.apply);
    app.get('/ext/api/dmm/makers', dmm.makerSearch);

    // -- 動画の拡張メタデータ
    app.get('/ext/api/video/:id/meta', meta.getMeta);
    app.put('/ext/api/video/:id/meta', meta.putMeta);

    // -- 拡張検索
    app.get('/ext/api/search/facets', search.facets);
    // -- 保存した検索 (v3.7.0)
    app.get('/ext/api/saved-searches', saved.list);
    app.put('/ext/api/saved-searches', saved.save);
    // -- ホームの並び (v3.8.0)
    app.get('/ext/api/home-layout', saved.homeGet);
    app.put('/ext/api/home-layout', saved.homeSave);
    app.get('/ext/api/videos/brief', search.brief);
    app.get('/ext/api/video/:id/siblings', search.siblings);
    app.get('/ext/api/calendar/days', search.calendarDays);
    app.get('/ext/api/series', search.seriesList);

    // -- タグ一覧 / タグサムネイル
    app.get('/ext/api/tags', tags.list);
    app.get('/ext/api/tag/thumb', tags.getThumb);
    app.post('/ext/api/tag/thumb', tags.setThumb);
    app.delete('/ext/api/tag/thumb', tags.deleteThumb);
    app.get('/ext/api/tag/screenshots', tags.screenshots);
    app.post('/ext/api/tag/thumb/from-screenshot', tags.setThumbFromScreenshot);
    // -- 動画タグ プリセットのグループレイアウト (# 見出し入り)
    app.get('/ext/api/video-tag-layout', tags.getVideoTagLayout);
    app.put('/ext/api/video-tag-layout', tags.setVideoTagLayout);
    // -- 動画単体のタグ 取得/設定
    app.get('/ext/api/video/:id/tags', tags.getVideoTags);
    app.put('/ext/api/video/:id/tags', tags.setVideoTags);

    // -- メーカー一覧 / メーカー情報
    app.get('/ext/api/makers', makers.list);
    app.put('/ext/api/maker', makers.update);
    app.get('/ext/api/maker/image', makers.getImage);
    app.post('/ext/api/maker/image', makers.setImage);

    // -- スクリーンショット枚数
    app.get('/ext/api/screenshots/counts', screenshots.counts);

    // -- 関連動画 (拡張メタデータ類似・事前計算)
    app.get('/ext/api/video/:id/related', related.getForVideo);
    app.get('/ext/api/related/weights', related.getWeightsRoute);
    app.put('/ext/api/related/weights', related.setWeightsRoute);
    app.post('/ext/api/related/rebuild', related.rebuild);

    // -- 出演者タグ プリセット
    app.get('/ext/api/performer-tags', performers.getPresetTags);
    app.put('/ext/api/performer-tags', performers.setPresetTags);

    // -- 出演者タグ 自動付与ルール
    app.get('/ext/api/performer-tag-rules', tagrules.getRules);
    app.put('/ext/api/performer-tag-rules', tagrules.setRules);
    app.post('/ext/api/performer-tag-rules/apply', tagrules.apply);

    // -- ブックマーク
    app.get('/ext/api/bookmark/folders', bookmark.folders);
    app.post('/ext/api/bookmark/folders', bookmark.createFolder);
    app.put('/ext/api/bookmark/folders/:id', bookmark.renameFolder);
    app.delete('/ext/api/bookmark/folders/:id', bookmark.deleteFolder);
    app.get('/ext/api/bookmark/ids', bookmark.ids);
    app.get('/ext/api/bookmark/video/:id', bookmark.videoFolders);
    app.post('/ext/api/bookmark/video/:id', bookmark.addVideo);
    app.delete('/ext/api/bookmark/video/:id', bookmark.removeVideo);

    // -- バックアップ
    //    書き出しには DMM の API ID が入り、復元は全置換なので、どちらも PC からだけ
    app.get('/ext/api/backup/export', pcOnly('バックアップの書き出し'), backup.exportAll);
    app.post('/ext/api/backup/import', pcOnly('バックアップの復元'), backup.importAll);

    // -- 一括操作
    app.post('/ext/api/bulk/tags', bulk.tags);
    app.post('/ext/api/bulk/meta', bulk.meta);
    app.post('/ext/api/bulk/bookmark', bulk.bookmark);
    app.post('/ext/api/bulk/delete/check', bulk.deleteCheck);
    app.post('/ext/api/bulk/delete', pcOnly('動画の削除'), bulk.delete);

    // -- 出演者
    app.get('/ext/api/performers/all', performers.all);
    app.post('/ext/api/performers/cleanup-unused', performers.cleanupUnused);
    app.get('/ext/api/performers', performers.list);
    app.post('/ext/api/performers', performers.create);
    app.get('/ext/api/performer/:id', performers.get);
    app.put('/ext/api/performer/:id', performers.update);
    app.get('/ext/api/performer/:id/image', performers.getImage);
    app.post('/ext/api/performer/:id/image', performers.setImage);
    app.get('/ext/api/performer/:id/videos', performers.relatedVideos);
    app.get('/ext/api/performer/:id/screenshots', performers.relatedScreenshots);

    // 4. ページ HTML への使用中のライブラリの埋め込み (静的配信より前に登録。v3.2.1 までは拡張スクリプトの注入も)
    app.use(createInject());

    console.log('[LadyTube] 拡張機能を読み込みました (/ext)');
};
