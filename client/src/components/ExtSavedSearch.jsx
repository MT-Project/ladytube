// LadyTube: 検索画面の「この条件を保存」(v3.7.0。SearchPage.jsx が件数の右に置く)。
// 名前を付けて、検索語・並び順・カテゴリーのフォルダを保存する (utils/savedSearches.js)。同じ名前があれば置き換える。
// 見た目は womanlive-ext.css の .wlext-savesearch-btn。
import { useRef } from 'react';
import { ExtDialog } from './ExtDialog';
import { Icon } from './ExtIcon';
import { openExtDialog } from '../utils/extDialog';
import { loadSavedSearches, saveSavedSearches } from '../utils/savedSearches';
import { toast } from '../utils/toast';

function SaveSearchDialog({ cond, onClose }) {
    const input = useRef(null);
    const folder = cond.path && cond.path !== 'root' ? cond.path.split(/[\\/]/).filter(Boolean).pop() : '';
    const save = async () => {
        const name = input.current.value.trim();
        if (!name) { toast('名前を入れてください', 'error'); return; }
        try {
            const list = (await loadSavedSearches()).filter(s => s.name !== name);
            await saveSavedSearches([...list, { name, ...cond }]);
            toast('「' + name + '」を保存しました。ホームと右上のメニューから開けます', 'success');
            onClose();
        } catch (e) { toast('保存に失敗: ' + e.message, 'error'); }
    };
    return (
        <ExtDialog title="この条件を保存" onClose={onClose} onSave={save} saveLabel="保存">
            <div style={{ fontSize: '0.85rem' }}>
                <div style={{ marginBottom: '0.5rem', color: 'var(--text-secondary,#888)' }}>検索語・並び順・カテゴリーのフォルダを保存します。同じ名前があれば置き換えます。名前の変更・並べ替え・削除は管理画面の「保存した検索」で行えます。</div>
                <input ref={input} className="wlext-input" style={{ width: '100%', boxSizing: 'border-box' }} autoFocus
                    defaultValue={cond.q || folder || 'すべての動画'} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
            </div>
        </ExtDialog>
    );
}

export function ExtSaveSearchButton({ q, sort, path }) {
    return (
        <button className="wlext-savesearch-btn" title="この条件を保存（ホームと右上のメニューから開けるようにする）"
            onClick={() => openExtDialog(SaveSearchDialog, { cond: { q, sort, path } })}>
            <Icon name="filter" size={14} /><span>この条件を保存</span>
        </button>
    );
}
