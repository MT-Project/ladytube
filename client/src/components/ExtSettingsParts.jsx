// LadyTube: 管理画面 (SettingsPage.jsx) の拡張の項目 (v3.1.15 までの server/ext/public/settings.js と library.js の差し込み)。
//  ・ExtSettingsSection: 拡張が作る項目 (window.WLExt.settingsSections[name]) を、この位置に置く。
//    項目の中身 (カバー画像・DMM・タグの自動付与・関連動画・メンテナンス・バックアップ・ライブラリ) は拡張のまま。
//    以前と同じく項目は本体の項目と同じ親の直下に並べる (settingsnav.js と private の importui.js などが、その並びを見る)。
//    目印に見えない <template> を残し、その前に差し込む。
//  ・ExtMetaReplace: 本体の「タグ置換」の代わりの「メタデータ置換」(タグのほか、ジャンル・出演者・シリーズなども置換できる)。
//    本体の項目と同じ見た目にするため、クラス名は SettingsPage から受け取る (以前は隠した本体の欄から借りていた)。
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Tag } from 'lucide-react';

export function ExtSettingsSection({ name }) {
    const ref = useRef(null);
    useLayoutEffect(() => {
        const marker = ref.current;
        let node = null;
        const mount = () => {
            const make = window.WLExt && window.WLExt.settingsSections && window.WLExt.settingsSections[name];
            if (!make || node || !marker.parentNode) return;
            node = make();
            marker.parentNode.insertBefore(node, marker);
        };
        mount();
        if (!node) window.addEventListener('DOMContentLoaded', mount, { once: true });   // 拡張は defer で読むので、まだなら読み終わってから
        return () => { window.removeEventListener('DOMContentLoaded', mount); if (node) node.remove(); };
    }, [name]);
    return <template ref={ref} />;
}

// cls: { section, title, icon, box, desc, input, button } (SettingsPage の styles)
export function ExtMetaReplace({ cls }) {
    const [kinds, setKinds] = useState([]);
    const [label, setLabel] = useState('');
    const selRef = useRef(null), beforeRef = useRef(null), afterRef = useRef(null);
    useEffect(() => {
        fetch('/ext/api/metadata/replace-kinds').then(r => (r.ok ? r.json() : [])).then(k => {
            const list = Array.isArray(k) ? k : [];
            setKinds(list);
            setLabel(list.length ? list[0].label : '');
        }).catch(() => { });
    }, []);
    const selectedLabel = () => { const s = selRef.current; return ((s && s.options[s.selectedIndex]) || {}).text || ''; };
    const run = () => {
        const WL = window.WLExt; if (!WL) return;
        const before = beforeRef.current, after = afterRef.current;
        const b = before.value.trim(), a = after.value.trim();
        if (!b || !a) { WL.toast('置換対象と置換後の両方を入力してください', 'error'); return; }
        if (b === a) { WL.toast('置換対象と置換後が同じです', 'error'); return; }
        const kind = selRef.current.value, l = selectedLabel();
        const body = WL.h('div', null, [
            WL.h('div', { style: { marginBottom: '0.5rem' } }, '置換すると元に戻せません。置換していいですか？'),
            WL.h('div', { style: { fontSize: '0.9rem' } }, l + '：' + b + ' → ' + a)
        ]);
        WL.dialog('メタデータ置換', body, {
            saveLabel: '置換', danger: true,
            onSave: async (close) => {
                try {
                    const r = await WL.api.replaceMetadata(kind, b, a);
                    WL.toast(r.changed + ' 件の' + l + 'を置換しました', 'success');
                    before.value = ''; after.value = '';
                    close();
                } catch (e) { WL.toast('置換に失敗しました: ' + e.message, 'error'); }
            }
        });
    };
    const ph = (head) => (kinds.length ? head + 'の' + label : head);
    return (
        <div className={'wlext-replace-section ' + cls.section}>
            <h2 className={cls.title}>
                <Tag size={18} className={cls.icon} />
                メタデータ置換
            </h2>
            <div className={cls.box}>
                <p className={cls.desc}>すでに設定済みのメタデータを置換します。(タグ等はプリセット側も変更されます)</p>
                <div className="wlext-field">
                    <label>置換するメタデータ</label>
                    <select ref={selRef} className={cls.input} style={{ marginBottom: '0.5rem' }} onChange={() => setLabel(selectedLabel())}>
                        {kinds.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
                    </select>
                </div>
                <div className="wlext-field"><input ref={beforeRef} className={cls.input} type="text" spellCheck="false" placeholder={ph('置換対象')} /></div>
                <div className="wlext-field"><input ref={afterRef} className={cls.input} type="text" spellCheck="false" placeholder={ph('置換後')} /></div>
                <div className="wlext-inline"><button className={cls.button} onClick={run}>置換</button></div>
            </div>
        </div>
    );
}
