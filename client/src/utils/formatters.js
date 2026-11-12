export function formatDuration(seconds) {
    if (!seconds) return "---";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const dateToFormat = dateStr.includes('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z';
        return new Date(dateToFormat).toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    } catch (e) { return ''; }
}

export function formatDateTime(dateStr) {
    if (!dateStr) return '';
    try {
        const dateToFormat = dateStr.includes('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z';
        return new Date(dateToFormat).toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) { return ''; }
}

export function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function getFolderPath(fullPath) {
    if (!fullPath) return '';
    const lastSlash = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'));
    return lastSlash > 0 ? fullPath.substring(0, lastSlash) : fullPath;
}

export function getFolderName(path) {
    if (!path) return '';
    const lastSepIndex = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
    if (lastSepIndex === -1) return '';
    const dir = path.substring(0, lastSepIndex);
    const dirLastSep = Math.max(dir.lastIndexOf('\\'), dir.lastIndexOf('/'));
    return dirLastSep === -1 ? dir : dir.substring(dirLastSep + 1);
}

export function removeExtension(filename) {
    if (!filename) return '';
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1) return filename;
    return filename.substring(0, lastDot);
}

// LadyTube: 画面に出す動画名。表示動画名 (ext_display_name) があり、表示設定で使うときはファイル名の代わりに出す。
// 拡張子を表示する設定なら、表示動画名にも元のファイルの拡張子を付ける。
// (本家の表示名 display_name は、これまでどおり呼び出し側で後ろに足す)
export function videoName(video, showExtension, showDisplayName) {
    const filename = (video && video.filename) || '';
    const disp = showDisplayName && video && video.ext_display_name;
    if (!disp) return showExtension ? filename : removeExtension(filename);
    return showExtension ? disp + filename.slice(removeExtension(filename).length) : disp;
}

// LadyTube: 公開日 (拡張メタデータの release_date。'YYYY-MM-DD' を端末の日付として読む) を「2024/03/15」に
function parseYmd(s) {
    const m = String(s || '').trim().replace(/[./]/g, '-').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m) return null;
    const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    return isNaN(d.getTime()) ? null : d;
}
export function formatYmd(s) {
    const d = parseYmd(s);
    if (!d) return s || '';
    return d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');
}
// LadyTube: 公開日から今日までを「2年7ヶ月前」「今月」「発売前」の形に
export function formatYmAgo(s) {
    const d = parseYmd(s);
    if (!d) return '';
    const now = new Date();
    let y = now.getFullYear() - d.getFullYear();
    let m = now.getMonth() - d.getMonth();
    if (now.getDate() < d.getDate()) m--;
    if (m < 0) { y--; m += 12; }
    if (y < 0) return '発売前';
    if (y === 0) return (m <= 0 ? '今月' : m + 'ヶ月前');
    return y + '年' + (m > 0 ? m + 'ヶ月' : '') + '前';
}
