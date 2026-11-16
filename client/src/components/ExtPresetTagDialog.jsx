// LadyTube: プリセットのタグから選ぶダイアログ (v3.2.1 までは拡張の core.js の WL.presetTagDialog)。openExtDialog で開く。
// 使うところ: 動画ページのタグ編集 (utils/videoMeta.js)・一括のタグ追加 (ExtVideoMenu.jsx)・出演者タグ (PerformerPage.jsx)。
//  props: title / current (選ばれているタグ) / loadPresets() / savePresets(arr) / onSave(selected) (済んだら閉じる)
// プリセットは「# 名前」「## 名前」の見出しでグループにでき (utils/tagPresets.js の parseTagGroups)、見出しを押すと畳む。
// プリセットに無い選択中のタグは先頭のグループに足す。「プリセット編集...」で1行1タグの欄に替わり、タイトルの右に「？」のヘルプ。
// 見た目は womanlive-ext.css の .wlext-tagselect-* / .wlext-taggroup-*。
import { useEffect, useRef, useState } from 'react';
import { ExtDialog } from './ExtDialog';
import { ExtHelpButton } from './ExtNavParts';
import { parseTagGroups } from '../utils/tagPresets';
import { toast } from '../utils/toast';

const PRESET_HELP = <>
    <div className="wlext-help-title">プリセット編集のヘルプ</div>
    <div className="wlext-help-note">行頭に #（または全角 ＃） を付けるとグループ見出しになります。 ## 名前 でさらに下位グループ（ネスト）となります。見出しと次の見出しの間のタグがそのグループに属します。</div>
</>;
const PLACEHOLDER = 'タグを1行に1つずつ入力...\n「# 名前」でグループ、「## 名前」で下位グループ(ネスト)。\n例:\n# 干支\n犬\n猿\n# 魚\nマグロ';

export default function ExtPresetTagDialog({ title, current, loadPresets, savePresets, onSave, onClose }) {
    const [selected, setSelected] = useState(() => (current || []).slice());
    const [presets, setPresets] = useState(null);   // null = 読み込み中 (読めなければ空)
    const [editing, setEditing] = useState(false);
    const [collapsed, setCollapsed] = useState({});   // グループの path -> true (畳んだ)
    const text = useRef(null);
    useEffect(() => {
        Promise.resolve(loadPresets()).then(p => setPresets(Array.isArray(p) ? p : []), () => setPresets([]));
    }, [loadPresets]);

    const toggle = (name) => setSelected(s => (s.includes(name) ? s.filter(t => t !== name) : [...s, name]));
    const row = (tags) => (
        <div className="wlext-tagselect-row">
            {tags.map(t => <div key={t} className={'wlext-tagselect-item' + (selected.includes(t) ? ' on' : '')} onClick={() => toggle(t)}>{t}</div>)}
        </div>
    );
    const group = (node) => {
        const shut = !!collapsed[node.path];
        return (
            <div key={node.path} className="wlext-taggroup">
                <div className="wlext-taggroup-header" onClick={() => setCollapsed(c => ({ ...c, [node.path]: !shut }))}>
                    <span className="wlext-taggroup-name">{node.name}</span><span className="wlext-taggroup-tri">{shut ? '▶' : '▼'}</span>
                </div>
                {!shut && <div className="wlext-taggroup-body">{node.tags.length > 0 && row(node.tags)}{node.children.map(group)}</div>}
            </div>
        );
    };
    const tree = parseTagGroups(presets);
    const inPresets = new Set();
    (function walk(n) { n.tags.forEach(t => inPresets.add(t)); n.children.forEach(walk); })(tree);
    selected.forEach(t => { if (!inPresets.has(t)) { tree.tags.push(t); inPresets.add(t); } });
    tree.tags = [...new Set(tree.tags)];

    const editOrSave = async () => {
        if (!editing) { text.current.value = (presets || []).join('\n'); setEditing(true); return; }
        const arr = text.current.value.split('\n').map(s => s.trim()).filter(Boolean);
        try { await savePresets(arr); } catch (e) { toast('プリセットの保存に失敗: ' + e.message, 'error'); return; }
        setPresets([...new Set(arr)]);
        setEditing(false);
        toast('プリセットタグを保存しました', 'success');
    };
    const ok = async () => {
        if (editing) { toast('先に「プリセットを保存」を押してください', 'error'); return; }
        await onSave(selected);
        onClose();
    };
    const heading = editing ? <>プリセット編集...<ExtHelpButton content={PRESET_HELP} tooltip="プリセット編集のヘルプ" /></> : (title || 'タグを設定');
    return (
        <ExtDialog title={heading} onClose={onClose} onSave={ok} saveLabel="OK">
            <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.6rem' }}>
                    <button className="wlext-btn" onClick={editOrSave}>{editing ? 'プリセットを保存' : 'プリセット編集...'}</button>
                </div>
                <div className="wlext-tagselect" style={editing ? { display: 'none' } : undefined}>
                    {presets && (inPresets.size
                        ? <>{tree.tags.length > 0 && row(tree.tags)}{tree.children.map(group)}</>
                        : <div style={{ color: 'var(--text-secondary,#888)', fontSize: '0.85rem' }}>プリセットタグがありません。「プリセット編集...」で追加してください。</div>)}
                </div>
                <textarea ref={text} className="wlext-textarea" style={{ minHeight: '220px', display: editing ? 'block' : 'none' }} placeholder={PLACEHOLDER} />
            </div>
        </ExtDialog>
    );
}
