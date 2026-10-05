import { useState } from 'react';

function BenefitsInput({ value, onValueChange, benefits, onAdd, onRemove, error, onBlur }) {
    // Only changes how the label looks, so it lives here instead of in the parent
    const [focused, setFocused] = useState(false);

    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();

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