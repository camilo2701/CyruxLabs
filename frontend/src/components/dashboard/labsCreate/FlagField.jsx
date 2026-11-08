// Este archivo se encarga del campo de "flag" del laboratorio: permite escribirla o generarla
// automáticamente y muestra su error de validación.
import { generateFlag, FLAG_MAX } from '../../../utils/labRules.js';

// Este componente se encarga de renderizar el input de la flag y el botón para generarla.
function FlagField({ value, onChange, onBlur, error }) {
    // Esta función se encarga de generar una flag aleatoria y disparar el cambio y la validación.
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