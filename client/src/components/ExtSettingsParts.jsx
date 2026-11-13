// LadyTube: 管理画面 (SettingsPage.jsx) の拡張の部品 (v3.1.15 までの server/ext/public/settings.js・library.js の差し込みと settingsnav.js)。
//  ・ExtSettingsSection: 拡張が作る項目 (window.WLExt.settingsSections[name]) を、この位置に置く。
//    項目の中身 (カバー画像・DMM・タグの自動付与・関連動画・メンテナンス・バックアップ・ライブラリ) は拡張のまま。
//    name を付けないと、個人用モジュールなどが WLExt.settingsExtras に足した項目を、足した順にすべて置く (管理画面の末尾)。
//    項目は本体の項目と同じ親の直下に並べる (ExtSettingsNav がその並びを見る)。目印に見えない <template> を残し、その前に差し込む。
//  ・ExtMetaReplace: 本体の「タグ置換」の代わりの「メタデータ置換」(タグのほか、ジャンル・出演者・シリーズなども置換できる)。
//    本体の項目と同じ見た目にするため、クラス名は SettingsPage から受け取る (以前は隠した本体の欄から借りていた)。
//  ・ExtSettingsNav: 左上の「設定項目」ボタンで開閉するサイドメニュー。項目を押すとその位置へ移る。
//    見た目は検索の絞り込み (ExtFacets.jsx) と同じ womanlive-ext.css の .wlext-facets* と、body の wlext-setnav-on / wlext-setnav-open。
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tag } from 'lucide-react';
import { Icon } from './ExtIcon';
import ExtSlot from './ExtSlot';

export function ExtSettingsSection({ name }) {
    return name ? <ExtSlot from="settingsSections" name={name} /> : <ExtSlot from="settingsExtras" />;
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

const NAV_OPEN_KEY = 'wlext_setnav_open';
const NAV_NARROW = '(max-width: 900px), (pointer: coarse)';   // 既定で閉じる・項目を選ぶと閉じる画面 (本文に重ねて出す)
const EXT_PREFIX = '拡張機能：';
function navInitialOpen() {
    try {
        const v = localStorage.getItem(NAV_OPEN_KEY);
        if (v === '1') return true;
        if (v === '0') return false;
    } catch { /* 使えなければ既定 */ }
    return !window.matchMedia(NAV_NARROW).matches;
}
// 画面に出ている順の項目 [{el, name, ext}]。拡張の項目かどうかは見出しではなくクラスで見る
// (メタデータ置換は本体の体裁なので、見出しに「拡張機能：」が付かない)
function sectionsOf(container) {
    const out = [];
    for (const el of container.children) {
        const head = el.querySelector('h2, h3');
        if (!head) continue;
        let name = (head.textContent || '').trim();
        if (name.startsWith(EXT_PREFIX)) name = name.slice(EXT_PREFIX.length).trim();
        const cls = String(el.className || '');
        if (name) out.push({ el, name, ext: cls.includes('wlext-') || cls.includes('private-') });
    }
    return out;
}
const bottomOf = (ref) => (ref.current ? Math.max(0, Math.round(ref.current.getBoundingClientRect().bottom)) : 48);

// containerRef: 項目が並ぶ親 / headerRef: 管理画面の固定ヘッダー (ボタンとパネルはそのすぐ下)
export function ExtSettingsNav({ containerRef, headerRef }) {
    const [open, setOpen] = useState(navInitialOpen);
    const [list, setList] = useState([]);
    const btnRef = useRef(null), panelRef = useRef(null), backdropRef = useRef(null);
    const toggle = (on, remember = true) => {
        if (remember) { try { localStorage.setItem(NAV_OPEN_KEY, on ? '1' : '0'); } catch { /* 覚えられなくても開閉はする */ } }
        setOpen(on);
    };

    // body のクラスは CSS (パネルの表示・本文の左の余白・狭い画面の背景) が見る
    useLayoutEffect(() => {
        document.body.classList.add('wlext-setnav-on');
        return () => document.body.classList.remove('wlext-setnav-on', 'wlext-setnav-open');
    }, []);
    useLayoutEffect(() => { document.body.classList.toggle('wlext-setnav-open', open); }, [open]);

    // 一覧は画面の並びから拾う (個人用モジュールの項目も並ぶ)。拡張の項目は後から差し込まれるので、増減のたびに拾い直す
    useEffect(() => {
        const container = containerRef.current;
        const scan = () => setList(sectionsOf(container));
        const mo = new MutationObserver(scan);
        mo.observe(container, { childList: true });
        scan();
        return () => mo.disconnect();
    }, [containerRef]);

    useLayoutEffect(() => {
        const layout = () => {
            const top = bottomOf(headerRef);
            if (btnRef.current) btnRef.current.style.top = (top + 8) + 'px';
            if (panelRef.current) panelRef.current.style.top = (top + 46) + 'px';
            if (backdropRef.current) backdropRef.current.style.top = top + 'px';
        };
        layout();
        window.addEventListener('resize', layout);
        return () => window.removeEventListener('resize', layout);
    }, [open, headerRef]);

    // 固定ヘッダーに隠れないよう、その高さぶん手前で止める。
    // スムーススクロールは環境によって無視される (動かない) ので、確実に飛ぶ即時移動にする
    const jumpTo = (el) => {
        const top = el.getBoundingClientRect().top + window.scrollY - bottomOf(headerRef) - 12;
        window.scrollTo(0, Math.max(0, top));
        if (window.matchMedia(NAV_NARROW).matches) toggle(false, false);   // 狭い画面は本文に重ねているので閉じる (覚えない)
    };

    return createPortal(
        <>
            <div ref={backdropRef} className="wlext-facets-backdrop" onClick={() => toggle(false)} />
            <div ref={btnRef} className={'wlext-facets-btn' + (open ? ' on' : '')} title="設定項目メニューの開閉" onClick={() => toggle(!open)}>
                <Icon name="menu" size={15} /><span>設定項目</span>
            </div>
            {open && (
                <aside ref={panelRef} className="wlext-facets wlext-setnav">
                    <div className="wlext-facets-body">
                        {!list.length && <div className="wlext-facets-msg">設定項目が見つかりません</div>}
                        {list.map((s, i) => (
                            <div key={i + '|' + s.name} className="wlext-facet-item" title={s.name + ' へ移動'} onClick={() => jumpTo(s.el)}>
                                <span className="wlext-facet-name">{s.name}</span>
                                {s.ext && <span className="wlext-facet-count">Ex</span>}
                            </div>
                        ))}
                    </div>
                </aside>
            )}
        </>,
        document.body
    );
}
