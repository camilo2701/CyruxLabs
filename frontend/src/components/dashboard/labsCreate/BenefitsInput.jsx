// Este archivo se encarga del campo para agregar y mostrar los "beneficios" de un laboratorio como etiquetas.
import { useState } from 'react';

// Este componente se encarga de un input donde se escribe un beneficio y, al presionar Enter, se agrega
// a una lista de etiquetas que se pueden quitar una a una.
function BenefitsInput({ value, onValueChange, benefits, onAdd, onRemove, error, onBlur }) {
    // Only changes how the label looks, so it lives here instead of in the parent
    const [focused, setFocused] = useState(false);

    // Esta función se encarga de agregar el beneficio cuando se presiona Enter, evitando enviar el formulario.
    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();

        // Ignora espacios en blanco: no se agregan beneficios vacíos
        const trimmed = value.trim();
        if (trimmed === '') return;

        // The parent validates the text and tells us whether it was accepted
        if (onAdd(trimmed)) onValueChange('');
    };

    return (
        <div className="nebula-input--bnf">
            <input
                type="text"
                name="benefit"
                autoComplete="off"
                className="input"
                value={value}
                onChange={(e) => onValueChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={() => {
                    setFocused(false);
                    onBlur();
                }}
            />
            <label
                className={`user-label ${
                    focused || value.length > 0 ? 'user-label--float' : ''
                }`}
            >
                Beneficios (presiona Enter para agregar)
            </label>
            {/* Lista de beneficios ya agregados, cada uno con su botón para eliminarlo */}
            <div className="benefit-tags">
                {benefits.map((benefit, index) => (
                    <span key={index} className="benefit-tag">
                        {benefit}
                        <button type="button" onClick={() => onRemove(index)}>×</button>
                    </span>
                ))}
            </div>

            <p className="nebula-error">{error}</p>
        </div>
    );
}

export default BenefitsInput;