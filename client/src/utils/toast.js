// LadyTube: 本体の通知 (UIContext の showToast。右上に出る) を、部品の外の関数や拡張から移した画面からも出す。
// type は 'success' / 'error' / 'info' (省略時)。UIProvider が出す関数を渡すまで (最初の描画の前) は何もしない
let sink = null;
export const setToastSink = (f) => { sink = f; };
export const toast = (msg, type = 'info') => { if (sink) sink(msg, type); };

// private の画面も同じ通知を出す (WLExt.toast。v3.2.1 までは拡張の core.js の下の通知)
(window.WLExt = window.WLExt || {}).toast = toast;
