// LadyTube: 文字の複数値の入力欄 (Enter か「,」で足す。空のまま Backspace で最後を消す)。値は utils/chips.js の useChips が持つ。
// 見た目は womanlive-ext.css の .wlext-chips / .wlext-chip (拡張の WL.chipInput と同じ形)。Chip は1つの値 (×で外す)
export const Chip = ({ text, onRemove }) => <span className="wlext-chip">{text}<span className="x" onClick={onRemove}>×</span></span>;

export function ChipInput({ chips, placeholder }) {
    const { values, setValues, input } = chips;
    const onKeyDown = (e) => {
        const el = e.currentTarget;
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const t = el.value.trim();
            if (t && !values.includes(t)) setValues([...values, t]);
            el.value = '';
        } else if (e.key === 'Backspace' && !el.value && values.length) setValues(values.slice(0, -1));
    };
    return (
        <div className="wlext-chips" onClick={() => input.current.focus()}>
            {values.map((v, i) => <Chip key={v} text={v} onRemove={() => setValues(values.filter((_, j) => j !== i))} />)}
            <input ref={input} className="wlext-chip-input" placeholder={placeholder} onKeyDown={onKeyDown} />
        </div>
    );
}
