// =============================================================
// LadyTube: 起動時に開くブラウザ (v3.14.0)
//  設定 ext_browser = { mode, path, args }。全ライブラリ共通 (library.js の SHARED_KEYS)
//    mode: 'default' = 既定のブラウザ (本家と同じ start "" URL) / 'exe' = path の .exe で開く / 'none' = 開かない
//    args: exe のときに URL の前に渡す引数 (プロファイルやプライベートウィンドウなど)。"…" で空白を含む引数
//  ・本体 server/index.js の openInBrowser が openUrl を呼ぶ (ladytube.bat が -browser を付けて起動したとき)
//  ・list: Windows に登録されたブラウザ (レジストリの StartMenuInternet。HKLM・HKCU・WOW6432Node)
//  ・設定を変えられるのは PC からだけ (index.js の pcOnly。LAN の端末から、次の起動で好きな exe を実行させない)。
//    受け付けるのは実際にある .exe だけで、起動はシェルを通さず引数を配列で渡す。バックアップには入れない (PC ごとに違うため)
// =============================================================
const fs = require('fs');
const path = require('path');
const { exec, execFile, spawn } = require('child_process');
const { getSetting, setSetting } = require('./db');

const KEY = 'ext_browser';
const MODES = ['default', 'exe', 'none'];

// 引数の文字列を配列に ("…" は1つの引数)
function splitArgs(s) {
    const out = [];
    const re = /"([^"]*)"|(\S+)/g;
    let m;
    while ((m = re.exec(String(s || '')))) out.push(m[1] !== undefined ? m[1] : m[2]);
    return out;
}

// 画面から来た値を確かめてそろえる。だめなら Error (message は画面に出す)
function check(b) {
    b = b || {};
    const mode = MODES.includes(b.mode) ? b.mode : null;
    if (!mode) throw new Error('開き方の指定が正しくありません');
    if (mode !== 'exe') return { mode, path: '', args: '' };
    const p = String(b.path || '').trim().replace(/^"(.*)"$/, '$1');
    if (!p || !path.isAbsolute(p) || !/\.exe$/i.test(p)) throw new Error('ブラウザの場所は、.exe のファイルを「C:\\…\\chrome.exe」のように指定してください');
    let st = null;
    try { st = fs.statSync(p); } catch (e) { /* 下で断る */ }
    if (!st || !st.isFile()) throw new Error('ファイルが見つかりません: ' + p);
    const args = String(b.args || '').trim();
    if (args.length > 500 || /[\r\n\0]/.test(args)) throw new Error('起動のオプションは1行・500文字までです');
    return { mode, path: p, args };
}

const current = () => Object.assign({ mode: 'default', path: '', args: '' }, getSetting(KEY, {}) || {});
const save = (b) => setSetting(KEY, check(b));

function openDefault(url) {
    const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
    exec(cmd, (err) => { if (err) console.error('[LadyTube] ブラウザを開けません:', err.message); });
}

// b の設定で url を開く。開かない設定なら false
function launch(b, url) {
    if (b.mode === 'none') return false;
    if (b.mode !== 'exe') { openDefault(url); return true; }
    const child = spawn(b.path, [...splitArgs(b.args), url], { detached: true, stdio: 'ignore' });
    child.on('error', (e) => console.error('[LadyTube] ブラウザを開けません:', b.path, e.message));
    child.unref();
    return true;
}

// 起動時 (本体 server/index.js)。保存した exe が無くなっていたら (アンインストールなど) 既定のブラウザで開く
function openUrl(url) {
    let b;
    try { b = check(current()); }
    catch (e) { console.error('[LadyTube] 起動時に開くブラウザの設定が使えないので、既定のブラウザで開きます:', e.message); b = { mode: 'default' }; }
    launch(b, url);
}

// この PC に登録されたブラウザ [{ name, path }]。Internet Explorer は除く
const LIST_PS = `[Console]::OutputEncoding = [Text.Encoding]::UTF8
$out = @()
foreach ($root in 'HKLM:\\SOFTWARE\\Clients\\StartMenuInternet', 'HKCU:\\SOFTWARE\\Clients\\StartMenuInternet', 'HKLM:\\SOFTWARE\\WOW6432Node\\Clients\\StartMenuInternet') {
  if (Test-Path $root) {
    Get-ChildItem $root | ForEach-Object {
      $cmdKey = Join-Path $_.PSPath 'shell\\open\\command'
      if (Test-Path $cmdKey) { $out += [pscustomobject]@{ name = (Get-ItemProperty $_.PSPath).'(default)'; cmd = (Get-ItemProperty $cmdKey).'(default)' } }
    }
  }
}
ConvertTo-Json -InputObject @($out) -Compress`;
function list() {
    if (process.platform !== 'win32') return Promise.resolve([]);
    return new Promise((resolve) => {
        execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', LIST_PS],
            { encoding: 'utf8', windowsHide: true, timeout: 15000 }, (err, stdout) => {
                if (err) { console.error('[LadyTube] ブラウザの一覧を読めません:', err.message); return resolve([]); }
                let rows = [];
                try { rows = JSON.parse(stdout.trim() || '[]'); } catch (e) { return resolve([]); }
                const seen = new Set(), out = [];
                (Array.isArray(rows) ? rows : [rows]).forEach(r => {
                    const cmd = String((r && r.cmd) || '').trim();
                    const m = /^"([^"]+\.exe)"/i.exec(cmd) || /^(.+?\.exe)/i.exec(cmd);
                    if (!m) return;
                    const p = m[1];
                    const key = p.toLowerCase();
                    if (seen.has(key) || /\\iexplore\.exe$/i.test(p) || !fs.existsSync(p)) return;
                    seen.add(key);
                    out.push({ name: String((r && r.name) || path.basename(p, '.exe')), path: p });
                });
                resolve(out);
            });
    });
}

module.exports = { KEY, current, save, check, launch, openUrl, list, splitArgs };
