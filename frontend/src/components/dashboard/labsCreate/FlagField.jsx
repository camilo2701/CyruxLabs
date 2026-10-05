import { generateFlag, FLAG_MAX } from '../../../utils/labRules.js';

function FlagField({ value, onChange, onBlur, error }) {
    const handleGenerate = () => {
        const flag = generateFlag();
        onChange(flag);
        onBlur(flag);
    };

    return (
        <div className="nebula-input nebula-input--flag">
            <input
                required
                type="text"
                name="flag"
                autoComplete="off"
                spellCheck={false}
                className="input"
                maxLength={FLAG_MAX}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={(e) => onBlur(e.target.value)}
            />
            <label className="user-label">Flag del laboratorio</label>
            <button type="button" className="flag-generate-btn" onClick={handleGenerate}>
                Generar
            </button>
            <p className="nebula-error">{error}</p>
        </div>
    );
}

export default FlagField;