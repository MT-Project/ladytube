// LadyTube: 検索画面の選択モード (一括操作) の丸ボタン (v3.1.5 までの server/ext/public/bulkselect.js の前半を移したもの)。
// 下から 選択モード / 選択の解除 / 表示中をすべて選択 / 一括操作メニュー。画面の右下に固定 (body の末尾に置く)。
// 押したときのメニューとダイアログは拡張側 (bulkselect.js の WL.toggleBulkMenu)。見た目は womanlive-ext.css の .wlext-sel-*。
import { createPortal } from 'react-dom';

const svg = (p) => '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
const ICON_MODE = svg('<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>');
const ICON_ALL = svg('<polyline points="20 6 9 17 4 12"></polyline>');
const ICON_NONE = svg('<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>');
const ICON_MENU = svg('<circle cx="12" cy="5" r="1.6" fill="currentColor"></circle><circle cx="12" cy="12" r="1.6" fill="currentColor"></circle><circle cx="12" cy="19" r="1.6" fill="currentColor"></circle>');

export default function ExtSelectionFabs({ selectionMode, selectedIds, onToggleMode, onSelectAll, onDeselectAll }) {
    const count = selectedIds.size;
    const fab = (className, title, icon, onClick, show = true) => (
        <button className={className} title={title} style={{ display: show ? '' : 'none' }}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            dangerouslySetInnerHTML={{ __html: icon }} />
    );
    return createPortal(
        <div className="wlext-sel-fabs">
            <button className="wlext-sel-fab wlext-sel-menu-btn" title={'一括操作 (' + count + '件選択中)'} data-count={count}
                style={{ display: selectionMode && count > 0 ? '' : 'none' }}
                onClick={(e) => { e.stopPropagation(); window.WLExt?.toggleBulkMenu?.([...selectedIds], onDeselectAll); }}
                dangerouslySetInnerHTML={{ __html: ICON_MENU }} />
            {fab('wlext-sel-fab', '表示中をすべて選択', ICON_ALL, onSelectAll, selectionMode)}
            {fab('wlext-sel-fab', '選択をすべて解除', ICON_NONE, onDeselectAll, selectionMode)}
            {fab('wlext-sel-fab wlext-sel-mode-btn' + (selectionMode ? ' active' : ''), '選択モード', ICON_MODE, onToggleMode)}
        </div>,
        document.body
    );
}
