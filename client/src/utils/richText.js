// LadyTube: 作品紹介 (v3.13.0) の表示。手で入れた文や情報源から取った文には、改行やタグが入りうる。
// HTML として埋め込まず (dangerouslySetInnerHTML は使わない)、ブラウザの DOMParser で読んで、許可したタグだけを React の要素に組み直す。
//  ・許可するタグ: 改行・段落・太字・斜体・下線・取り消し線・箇条書き・リンク。属性はすべて捨てる (リンクの href だけ、http/https に限って残す)
//  ・script / style などは中身ごと捨てる。それ以外の知らないタグは外して、中の文字だけ残す
//  ・タグの無い文は、改行をそのまま改行として出す (呼び出し側の CSS の white-space: pre-line。plain が true)
// DOMParser で作った文書はページに入らないので、読んだ時点でスクリプトや画像の読み込みは起きない。
import { createElement, Fragment } from 'react';
import { normalizeUrl } from '../../../server/ext/perfurl.mjs';

const ALLOW = new Set(['br', 'p', 'div', 'b', 'strong', 'i', 'em', 'u', 's', 'del', 'ul', 'ol', 'li', 'a']);
const DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'svg', 'math', 'textarea', 'select', 'button', 'form', 'input']);

function build(node, key) {
    if (node.nodeType === 3) return node.nodeValue;   // 文字
    if (node.nodeType !== 1) return null;            // 注釈など
    const tag = node.nodeName.toLowerCase();
    if (DROP.has(tag)) return null;
    const kids = [...node.childNodes].map((c, i) => build(c, i));
    if (tag === 'br') return createElement('br', { key });
    if (tag === 'a') {
        const href = normalizeUrl(node.getAttribute('href'));
        return href ? createElement('a', { key, href, target: '_blank', rel: 'noopener noreferrer', className: 'wlext-link' }, kids)
            : createElement(Fragment, { key }, kids);
    }
    return ALLOW.has(tag) ? createElement(tag, { key }, kids) : createElement(Fragment, { key }, kids);
}

// 戻りは { nodes: React の子, plain: タグの無い文か }
export function richText(text) {
    const s = String(text || '');
    if (!/<[a-z!/]/i.test(s)) return { nodes: s, plain: true };
    const body = new DOMParser().parseFromString(s, 'text/html').body;
    return { nodes: [...body.childNodes].map((c, i) => build(c, i)), plain: false };
}

// 一覧などで短く見せる文 (タグを外し、空白を詰めて n 文字まで)
export function briefText(text, n = 60) {
    const t = String(text || '').replace(/<\/?[a-z][^>]*>/gi, ' ').replace(/\s+/g, ' ').trim();   // 「1 < 2」のような文字は残す
    return t.length > n ? t.slice(0, n) + '…' : t;
}
