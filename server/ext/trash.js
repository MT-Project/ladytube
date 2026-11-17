// =============================================================
// ファイルを Windows のごみ箱へ送る (動画の削除で使う)
//  SHFileOperation を PowerShell から呼ぶ。確認もエラーの画面も出さない。
//  パスは環境変数で渡す (引数にすると引用符や日本語の扱いで壊れる)。
// =============================================================
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// FO_DELETE(3) / FOF_ALLOWUNDO|FOF_NOCONFIRMATION|FOF_SILENT|FOF_NOERRORUI (0x454)
const SCRIPT = `
Add-Type -Namespace LT -Name Shell -MemberDefinition @'
[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
public struct SHFILEOPSTRUCT {
    public IntPtr hwnd; public uint wFunc; public string pFrom; public string pTo;
    public ushort fFlags; public bool fAnyOperationsAborted; public IntPtr hNameMappings; public string lpszProgressTitle;
}
[DllImport("shell32.dll", CharSet = CharSet.Unicode)]
public static extern int SHFileOperation(ref SHFILEOPSTRUCT op);
'@
foreach ($p in $env:LT_TRASH.Split([char]10)) {
    if (-not $p) { continue }
    $op = New-Object LT.Shell+SHFILEOPSTRUCT
    $op.wFunc = 3; $op.pFrom = $p + [char]0 + [char]0; $op.fFlags = 0x454
    [void][LT.Shell]::SHFileOperation([ref]$op)
}
`;
const ENCODED = Buffer.from(SCRIPT, 'utf16le').toString('base64');
const ENV_MAX = 20000;   // 環境変数1つは 32767 文字まで。余裕を見て分ける

// ごみ箱が使える場所か。ネットワークの共有 (\\\\server\\share) と、ルートに $RECYCLE.BIN の無いドライブ
// (USB メモリ・NAS を割り当てたドライブ) では、Windows はごみ箱に入れずに消す。
// ponytail: ごみ箱の容量を超える大きさのファイルも Windows は黙って消すが、ここでは見分けない
function canRecycle(p) {
    if (process.platform !== 'win32') return false;
    const root = path.parse(path.resolve(p)).root;
    return !root.startsWith('\\\\') && fs.existsSync(path.join(root, '$RECYCLE.BIN'));
}

// paths をごみ箱へ送る (ごみ箱が使えない場所のものは消す)。戻り: 消せずに残ったパスの Set
// ponytail: execFileSync は PowerShell の起動の間 (1〜2秒) サーバーを止める。削除は稀なので同期のまま
function removeFiles(paths) {
    const bin = [];
    for (const p of paths) {
        if (canRecycle(p)) bin.push(p);
        else try { fs.unlinkSync(p); } catch (e) { /* 残ったものは下で数える */ }
    }
    for (let i = 0; i < bin.length;) {
        const chunk = [];
        for (let len = 0; i < bin.length && (len += bin[i].length + 1) <= ENV_MAX; i++) chunk.push(bin[i]);
        if (!chunk.length) chunk.push(bin[i++]);   // 1本で上限を超えるパス (実際には無い)
        try {
            execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', ENCODED],
                { env: { ...process.env, LT_TRASH: chunk.join('\n') }, windowsHide: true, stdio: 'ignore', timeout: 120000 });
        } catch (e) { console.error('[ext trash]', e.message); }
    }
    return new Set(paths.filter(p => fs.existsSync(p)));
}

module.exports = { canRecycle, removeFiles };
