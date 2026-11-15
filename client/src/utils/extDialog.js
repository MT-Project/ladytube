// LadyTube: 本体の画面のどこからでも開けるダイアログ (同時に1つ)。openExtDialog(部品, props) で開き、部品には onClose が渡る。
// 置き場所は App.jsx の ExtDialogHost (components/ExtDialog.jsx)。カードの中に置くと、カードのクリックやマウスの出入りに
// ダイアログの中の操作が伝わってしまうので、ページの外に1つだけ置く。
let current = null;
const subs = new Set();
const emit = () => subs.forEach(f => f());

export function openExtDialog(Component, props) { current = { Component, props }; emit(); }
export function closeExtDialog() { current = null; emit(); }
export const subscribeExtDialog = (f) => { subs.add(f); return () => subs.delete(f); };
export const extDialogSnapshot = () => current;
