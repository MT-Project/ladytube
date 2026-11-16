// LadyTube: 文字の複数値の入力欄 (components/ExtChipInput.jsx の ChipInput) の値。v3.2.1 までは拡張の core.js の WL.chipInput。
// all() は打ちかけの文字も足して返す (拡張の getValues と同じ)
import { useRef, useState } from 'react';

export function useChips(initial) {
    const [values, setValues] = useState(initial);
    const input = useRef(null);
    const all = () => { const t = input.current.value.trim(); return t && !values.includes(t) ? [...values, t] : values.slice(); };
    return { values, setValues, input, all };
}
