// LadyTube: 拡張 (window.WLExt) が作る要素を、本体の画面のこの位置に置く差し込み口。
//  from: WLExt の差し込み口の名前。関数ならそれ1つ、{ 名前: 関数 } なら足された順にすべて (name を付けるとその1つだけ)
//  args: 作る関数に渡す値 (JSON にできるもの)。変わると作り直す
// 作る関数が null を返したら置かない。要素は目印の見えない <template> の前に差し込み、外れるときに消す
// (管理画面の項目・動画ページの欄・ヘッダーのライブラリ名。拡張は defer で読むので、まだの分は読み終わってから置く)。
import { useLayoutEffect, useRef } from 'react';

export default function ExtSlot({ from, name, args }) {
    const ref = useRef(null);
    const argsKey = JSON.stringify(args || {});
    useLayoutEffect(() => {
        const marker = ref.current;
        const a = JSON.parse(argsKey);
        const nodes = new Map();
        const mount = () => {
            const reg = window.WLExt && window.WLExt[from];
            if (!reg || !marker.parentNode) return;
            const makers = typeof reg === 'function' ? { [from]: reg } : name ? { [name]: reg[name] } : reg;
            for (const [key, make] of Object.entries(makers)) {
                if (typeof make !== 'function' || nodes.has(key)) continue;
                const node = make(a);
                if (!node) continue;
                nodes.set(key, node);
                marker.parentNode.insertBefore(node, marker);
            }
        };
        mount();
        window.addEventListener('DOMContentLoaded', mount, { once: true });
        return () => { window.removeEventListener('DOMContentLoaded', mount); nodes.forEach(n => n.remove()); };
    }, [from, name, argsKey]);
    return <template ref={ref} />;
}
