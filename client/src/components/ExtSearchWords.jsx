// LadyTube: 検索ワード (v3.14.0。ためる場所は utils/searchWords.js)
//  ・ExtPickWord: 動画ページで data-wlext-pick の欄 (タイトル・動画ファイル名・作品紹介) の文字を選ぶと、近くに「検索ワード」のボタンを出す。
//    日本語は空白で語を区切らないので、どこで切るかは選ぶ人が決める (自動の区切り Intl.Segmenter は人名や複合語を割ってしまう)
//  ・ExtFileWords: 動画ファイル名に空白があれば、空白で区切った語を押せるようにする (押すと検索ワードに足し、足した語は印が付いてもう一度押すと外す。
//    中クリックはその語の検索を新しいタブで。最後の語の末尾のパート番号 _N は語にしない)
//  ・ExtPasteWords: 検索欄の右の「貼り付け」。ためた語を検索欄の末尾に足し、ためた語は空にする (Navbar.jsx)
// 見た目は womanlive-ext.css の .wlext-pick-btn / .wlext-fword / .wlext-paste-*
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './ExtIcon';
import { addSearchWord, cleanWord, quoteWord, removeSearchWord, takeSearchWords, useSearchWords } from '../utils/searchWords';

// 選んだ範囲を、それが始まる (か終わる) data-wlext-pick の欄の中に切り詰めて返す
function picked() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const r = sel.getRangeAt(0).cloneRange();
    const host = (n) => { const el = n && (n.nodeType === 1 ? n : n.parentElement); return el && el.closest('[data-wlext-pick]'); };
    const h = host(r.startContainer) || host(r.endContainer);
    if (!h) return null;
    if (!h.contains(r.startContainer)) r.setStart(h, 0);
    if (!h.contains(r.endContainer)) r.setEnd(h, h.childNodes.length);
    const text = cleanWord(r.toString());
    if (!text) return null;
    const b = r.getBoundingClientRect();
    // 選んだ範囲の下 (画面の下に収まらなければ上)。スマホは文字を選ぶと上にブラウザのメニューが出るので、下を先に見る
    const top = b.bottom + 40 < window.innerHeight ? b.bottom + 6 : Math.max(4, b.top - 36);
    const left = Math.min(Math.max(4, b.left), window.innerWidth - 130);
    return { text, top, left };
}

export function ExtPickWord() {
    const [pick, setPick] = useState(null);
    useEffect(() => {
        let timer = 0;
        // 選び終わるまで (ドラッグ中・スマホのつまみを動かしている間) は待つ
        const later = () => { clearTimeout(timer); timer = setTimeout(() => setPick(picked()), 250); };
        // スクロールや画面の大きさが変わったら一度消して、止まったら置き直す
        const move = () => { setPick(null); later(); };
        document.addEventListener('selectionchange', later);
        document.addEventListener('scroll', move, true);
        window.addEventListener('resize', move);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('selectionchange', later);
            document.removeEventListener('scroll', move, true);
            window.removeEventListener('resize', move);
        };
    }, []);
    if (!pick) return null;
    return createPortal(
        <button type="button" className="wlext-pick-btn" style={{ top: pick.top, left: pick.left }} title={'「' + pick.text + '」を検索ワードに足す'}
            onMouseDown={(e) => e.preventDefault() /* 押しても選んだ範囲を消さない */}
            onClick={() => { addSearchWord(pick.text); window.getSelection().removeAllRanges(); setPick(null); }}>
            <Icon name="plus" size={14} /><span>検索ワード</span>
        </button>,
        document.body
    );
}

// 1つの語。ためた語に入っていれば印を付け、もう一度押すと外す
function FileWord({ word, on }) {
    const w = cleanWord(word);
    if (!w) return word;
    return (
        <span className={'wlext-fword' + (on.includes(w) ? ' on' : '')}
            title={on.includes(w) ? '押すと「' + w + '」を検索ワードから外す' : '押すと「' + w + '」を検索ワードに足す（中クリックでこの語を検索）'}
            data-wlext-href={'/search?q=' + encodeURIComponent(quoteWord(w))}
            onClick={() => {
                if (String(window.getSelection())) return;   // 文字を選んでいるときは選んだほう (ExtPickWord)
                if (on.includes(w)) removeSearchWord(w); else addSearchWord(w);
            }}>{word}</span>
    );
}

export function ExtFileWords({ filename }) {
    const on = useSearchWords();
    const name = String(filename || '');
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : '';
    if (!/\s/.test(stem.trim())) return name;
    // 空白も残して元の名前のとおりに並べる (奇数番目が空白)。最後の語の末尾のパート番号 (_2 など) は語にしない
    const parts = stem.split(/(\s+)/);
    const last = parts.length - 1, m = /^(.*?)(_\d+)$/.exec(parts[last]);
    return <>{parts.map((w, i) => (i % 2 || !w ? w
        : i === last && m ? <span key={i}><FileWord word={m[1]} on={on} />{m[2]}</span>
            : <FileWord key={i} word={w} on={on} />))}{ext}</>;
}

export function ExtPasteWords({ onPaste }) {
    const words = useSearchWords();
    if (!words.length) return null;
    return (
        <button className="wlext-action wlext-paste-btn" type="button"
            title={'検索ワードを検索欄に貼り付ける（' + words.join(' / ') + '）'}
            onClick={() => onPaste(takeSearchWords())}>
            <Icon name="clipboard-paste" size={20} />
            <span className="wlext-paste-count">{words.length}</span>
        </button>
    );
}
