import { TIME_MAX_SECONDS, FAILED_ATTEMPTS_MAX } from '../../../utils/labRules.js';
import { MAX_FRAGMENTS, FRAGMENT_MAX_LENGTH } from '../../../utils/trophyCriteria.js';

// The inputs of each kind of trophy criteria. disabled = the trophy was already earned by someone,
// so its criteria is frozen (the backend refuses to change it too).

const MAX_MINUTES = TIME_MAX_SECONDS / 60;

function describeTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes} min ${String(seconds).padStart(2, '0')} s`;
}

/* Time criteria: two boxes (minutes, seconds). The value is stored as total seconds. */
export function TimeCriteria({ value, onChange, onBlur, disabled }) {
  const total = Number(value) || 0;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;

  const update = (nextMinutes, nextSeconds) => {
    const m = Math.min(Math.max(nextMinutes, 0), MAX_MINUTES);
    const s = Math.min(Math.max(nextSeconds, 0), 59);
    onChange(String(Math.min(m * 60 + s, TIME_MAX_SECONDS)));
  };

  return (
    <>
      <div className="lvm-trophy-time">
        <input
          type="number"
          min="0"
          max={MAX_MINUTES}
          className="lvm-input lvm-input--compact lvm-input--short"
          value={minutes}
          disabled={disabled}
          onChange={(event) => update(parseInt(event.target.value, 10) || 0, seconds)}
          onFocus={(event) => event.target.select()}
          onBlur={onBlur}
          aria-label="Minutos"
        />
        <span>min</span>
        <input
          type="number"
          min="0"
          max="59"
          className="lvm-input lvm-input--compact lvm-input--short"
          value={seconds}
          disabled={disabled}
          onChange={(event) => update(minutes, parseInt(event.target.value, 10) || 0)}
          onFocus={(event) => event.target.select()}
          onBlur={onBlur}
          aria-label="Segundos"
        />
        <span>s</span>
      </div>
      <p className="lvm-hint">
        Se otorga si el estudiante resuelve el laboratorio en menos de {describeTime(total)}.
      </p>
    </>
  );
}

/* Failed attempts criteria: one number (0 = no mistakes at all) */
export function AttemptsCriteria({ value, onChange, onBlur, disabled }) {
  const attempts = Number(value) || 0;

  const handleChange = (event) => {
    const next = Math.min(Math.max(parseInt(event.target.value, 10) || 0, 0), FAILED_ATTEMPTS_MAX);
    onChange(String(next));
  };

  return (
    <>
      <div className="lvm-trophy-time">
        <input
          type="number"
          min="0"
          max={FAILED_ATTEMPTS_MAX}
          className="lvm-input lvm-input--compact lvm-input--short"
          value={attempts}
          disabled={disabled}
          onChange={handleChange}
          onFocus={(event) => event.target.select()}
          onBlur={onBlur}
          aria-label="Intentos fallidos permitidos"
        />
        <span>intentos fallidos</span>
      </div>
      <p className="lvm-hint">
        {attempts === 0
          ? 'Se otorga si resuelve el laboratorio sin ningún intento fallido.'
          : `Se otorga si lo resuelve con ${attempts} intento${attempts === 1 ? '' : 's'} fallido${attempts === 1 ? '' : 's'} o menos.`}
      </p>
    </>
  );
}

const FRAGMENT_COPY = {
  command: {
    placeholders: ['p. ej. nmap', 'p. ej. -sV'],
    hint: 'Se otorga si algún comando escrito en la terminal contiene todos los fragmentos, en cualquier orden (distingue mayúsculas). Basta con escribirlo, aunque no funcione.',
  },
  process: {
    placeholders: ['p. ej. hydra', 'p. ej. ssh'],
    hint: 'Se otorga si algún proceso en ejecución contiene todos los fragmentos, en cualquier orden (distingue mayúsculas). Se revisa cada ~10 segundos: sirve para herramientas que corren un rato (hydra, hashcat); para comandos rápidos usa «Comando».',
  },
};

/* Command / process criteria: 1 to 4 text fragments. The value is the list of fragments. */
export function FragmentsCriteria({ kind, value, onChange, onBlur, disabled }) {
  const fragments = Array.isArray(value) && value.length > 0 ? value : [''];
  const copy = FRAGMENT_COPY[kind];

  const updateFragment = (index, text) => {
    onChange(fragments.map((fragment, i) => (i === index ? text : fragment)));
  };
  const addFragment = () => {
    if (fragments.length < MAX_FRAGMENTS) onChange([...fragments, '']);
  };
  const removeFragment = (index) => onChange(fragments.filter((_, i) => i !== index));

  return (
    <>
      <div className="lvm-fragments">
        {fragments.map((fragment, index) => (
          <div key={index} className="lvm-fragment">
            <div className="lvm-fragment-row">
              <input
                type="text"
                className="lvm-input lvm-input--compact lvm-input--mono"
                maxLength={FRAGMENT_MAX_LENGTH}
                autoComplete="off"
                spellCheck={false}
                placeholder={copy.placeholders[Math.min(index, 1)]}
                value={fragment}
                disabled={disabled}
                onChange={(event) => updateFragment(index, event.target.value)}
                onBlur={onBlur}
                aria-label={`Fragmento ${index + 1}`}
              />
              {fragments.length > 1 && !disabled && (
                <button
                  type="button"
                  className="lvm-icon-button"
                  onClick={() => removeFragment(index)}
                  aria-label={`Eliminar fragmento ${index + 1}`}
                >
                  ×
                </button>
              )}
            </div>
            <span className="lvm-counter">{fragment.length}/{FRAGMENT_MAX_LENGTH}</span>
          </div>
        ))}

        {!disabled && (
          <button
            type="button"
            className="lvm-dashed-button"
            onClick={addFragment}
            disabled={fragments.length >= MAX_FRAGMENTS}
          >
            Añadir fragmento ({fragments.length}/{MAX_FRAGMENTS})
          </button>
        )}
      </div>
      <p className="lvm-hint">
        {copy.hint} El trofeo cuenta aunque el estudiante no resuelva el laboratorio.
      </p>
    </>
  );
}
