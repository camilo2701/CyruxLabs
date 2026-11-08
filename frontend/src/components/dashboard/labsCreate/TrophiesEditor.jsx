// Este archivo se encarga del editor de trofeos al crear un laboratorio: permite
// añadir trofeos personalizados (bronce/plata/oro) y configurar su criterio de
// obtención (tiempo, intentos fallidos o fragmentos de comando/proceso).
import { useState } from 'react';
import {
    MAX_CUSTOM_TROPHIES,
    MAX_TROPHIES_BY_TYPE,
    TROPHY_TYPE_LABELS,
    TROPHY_NAME_MAX,
    TROPHY_DESC_MAX,
    CRITERIA_TYPES,
    FRAGMENT_CRITERIA,
    COMPLETION_TROPHY,
    TIME_MAX_SECONDS,
    FAILED_ATTEMPTS_MAX,
    getTrophyErrorList,
} from '../../../utils/labRules.js';
import { MAX_FRAGMENTS, FRAGMENT_MAX_LENGTH } from '../../../utils/trophyCriteria.js';

// Esta constante se encarga de mapear el tipo numérico de trofeo a su clase CSS.
const TYPE_CLASS = { 0: 'bronze', 1: 'silver', 2: 'gold' };
// Esta constante se encarga de calcular el máximo de minutos a partir del tope en segundos.
const MAX_MINUTES = TIME_MAX_SECONDS / 60;

// Esta función se encarga de devolver el criterio por defecto según el tipo elegido,
// creando un valor nuevo cada vez para que las tarjetas no compartan el mismo array.
// A fresh value each time, so cards never share the same array
function getDefaultCriteria(criteriatype) {
    if (FRAGMENT_CRITERIA.includes(criteriatype)) return [''];
    return criteriatype === 'failed_attempts' ? '0' : '300';
}

// Contador incremental que da un id único a cada tarjeta de trofeo creada.
let nextTrophyId = 1;

// Esta función se encarga de crear un trofeo nuevo con valores por defecto.
// The id only identifies the card in the list; the backend ignores it
function createTrophy() {
    return {
        id: nextTrophyId++,
        type: 0,
        name: '',
        description: '',
        criteriatype: 'time',
        criteria: getDefaultCriteria('time'),
    };
}

// Esta función se encarga de convertir un total de segundos en un texto legible "X min YY s".
function describeTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes} min ${String(seconds).padStart(2, '0')} s`;
}

// Este componente se encarga del criterio por tiempo: dos campos (minutos y
// segundos) cuyo valor se guarda internamente como total de segundos.
/* Time criteria: two boxes (minutes, seconds). The value is stored as total seconds. */
function TimeCriteria({ value, onChange, onBlur }) {
    const total = Number(value) || 0;
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;

    // Esta función se encarga de recomponer el total de segundos a partir de los dos
    // campos, acotando minutos y segundos a sus rangos válidos.
    const update = (nextMinutes, nextSeconds) => {
        const m = Math.min(Math.max(nextMinutes, 0), MAX_MINUTES);
        const s = Math.min(Math.max(nextSeconds, 0), 59);
        onChange(String(Math.min(m * 60 + s, TIME_MAX_SECONDS)));
    };

    return (
        <>
            <div className="trophy-editor__time">
                <input
                    type="number"
                    min="0"
                    max={MAX_MINUTES}
                    className="trophy-editor__input trophy-editor__input--short"
                    value={minutes}
                    onChange={(e) => update(parseInt(e.target.value, 10) || 0, seconds)}
                    onFocus={(e) => e.target.select()}
                    onBlur={onBlur}
                    aria-label="Minutos"
                />
                <span>min</span>
                <input
                    type="number"
                    min="0"
                    max="59"
                    className="trophy-editor__input trophy-editor__input--short"
                    value={seconds}
                    onChange={(e) => update(minutes, parseInt(e.target.value, 10) || 0)}
                    onFocus={(e) => e.target.select()}
                    onBlur={onBlur}
                    aria-label="Segundos"
                />
                <span>s</span>
            </div>
            <p className="trophy-editor__hint">
                Se otorga si el estudiante resuelve el laboratorio en menos de {describeTime(total)}.
            </p>
        </>
    );
}

// Este componente se encarga del criterio por intentos fallidos: un único número
// (0 significa resolver sin ningún error).
/* Failed attempts criteria: one number (0 = no mistakes at all) */
function AttemptsCriteria({ value, onChange, onBlur }) {
    const attempts = Number(value) || 0;

    // Esta función se encarga de acotar el número de intentos al rango permitido.
    const handleChange = (e) => {
        const next = Math.min(Math.max(parseInt(e.target.value, 10) || 0, 0), FAILED_ATTEMPTS_MAX);
        onChange(String(next));
    };

    return (
        <>
            <div className="trophy-editor__time">
                <input
                    type="number"
                    min="0"
                    max={FAILED_ATTEMPTS_MAX}
                    className="trophy-editor__input trophy-editor__input--short"
                    value={attempts}
                    onChange={handleChange}
                    onFocus={(e) => e.target.select()}
                    onBlur={onBlur}
                    aria-label="Intentos fallidos permitidos"
                />
                <span>intentos fallidos</span>
            </div>
            <p className="trophy-editor__hint">
                {attempts === 0
                    ? 'Se otorga si resuelve el laboratorio sin ningún intento fallido.'
                    : `Se otorga si lo resuelve con ${attempts} intento${attempts === 1 ? '' : 's'} fallido${attempts === 1 ? '' : 's'} o menos.`}
            </p>
        </>
    );
}

// Esta constante se encarga de guardar los textos de ayuda y placeholders para
// cada tipo de criterio por fragmentos (comando o proceso).
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

// Este componente se encarga del criterio por fragmentos (comando/proceso): de 1 a
// 4 fragmentos de texto; el valor es la lista de fragmentos.
/* Command / process criteria: 1 to 4 text fragments. The value is the list of fragments. */
function FragmentsCriteria({ kind, value, onChange, onBlur }) {
    const fragments = Array.isArray(value) && value.length > 0 ? value : [''];
    const copy = FRAGMENT_COPY[kind];

    // Esta función se encarga de reemplazar el texto del fragmento en la posición dada.
    const updateFragment = (index, text) => {
        onChange(fragments.map((fragment, i) => (i === index ? text : fragment)));
    };
    // Esta función se encarga de añadir un fragmento vacío si no se alcanzó el máximo.
    const addFragment = () => {
        if (fragments.length < MAX_FRAGMENTS) onChange([...fragments, '']);
    };
    // Esta función se encarga de quitar el fragmento de la posición indicada.
    const removeFragment = (index) => onChange(fragments.filter((_, i) => i !== index));

    return (
        <>
            <div className="trophy-editor__fragments">
                {fragments.map((fragment, index) => (
                    <div key={index} className="trophy-editor__fragment">
                        <div className="trophy-editor__fragment-row">
                            <input
                                type="text"
                                className="trophy-editor__input"
                                maxLength={FRAGMENT_MAX_LENGTH}
                                autoComplete="off"
                                spellCheck={false}
                                placeholder={copy.placeholders[Math.min(index, 1)]}
                                value={fragment}
                                onChange={(e) => updateFragment(index, e.target.value)}
                                onBlur={onBlur}
                                aria-label={`Fragmento ${index + 1}`}
                            />
                            {fragments.length > 1 && (
                                <button
                                    type="button"
                                    className="trophy-editor__remove"
                                    onClick={() => removeFragment(index)}
                                    aria-label={`Eliminar fragmento ${index + 1}`}
                                >
                                    ×
                                </button>
                            )}
                        </div>
                        <span className="trophy-editor__counter">
                            {fragment.length}/{FRAGMENT_MAX_LENGTH}
                        </span>
                    </div>
                ))}

                <button
                    type="button"
                    className="trophy-editor__fragment-add"
                    onClick={addFragment}
                    disabled={fragments.length >= MAX_FRAGMENTS}
                >
                    Añadir fragmento ({fragments.length}/{MAX_FRAGMENTS})
                </button>
            </div>
            <p className="trophy-editor__hint">
                {copy.hint} El trofeo cuenta aunque el estudiante no resuelva el laboratorio.
            </p>
        </>
    );
}

// Este componente se encarga de orquestar todo el editor de trofeos: la lista de
// tarjetas, el resumen de cupos por tipo y la gestión de errores de validación.
function TrophiesEditor({ trophies, onChange, showAllErrors, error }) {
    // Registra qué campos ha tocado el usuario para decidir cuándo mostrar errores.
    const [touched, setTouched] = useState({});

    // Lista de errores por trofeo, calculada según las reglas de validación.
    const errorList = getTrophyErrorList(trophies);

    // Esta función se encarga de marcar un campo como "tocado" (clave id:campo).
    const touch = (id, field) => setTouched((prev) => ({ ...prev, [`${id}:${field}`]: true }));
    // Esta función se encarga de decidir si se muestra el error de un campo: al forzar todos o si fue tocado.
    const isShown = (id, field) => showAllErrors || touched[`${id}:${field}`];

    // Esta función se encarga de aplicar cambios parciales al trofeo con el id dado.
    const updateTrophy = (id, changes) => {
        onChange(trophies.map((t) => (t.id === id ? { ...t, ...changes } : t)));
    };

    // Esta función se encarga de eliminar el trofeo con el id dado.
    const removeTrophy = (id) => onChange(trophies.filter((t) => t.id !== id));

    // Esta función se encarga de añadir un trofeo nuevo si no se superó el máximo permitido.
    const addTrophy = () => {
        if (trophies.length < MAX_CUSTOM_TROPHIES) onChange([...trophies, createTrophy()]);
    };

    // Esta función se encarga de contar cuántos trofeos hay de un tipo (opcionalmente
    // excluyendo uno), para controlar los cupos por bronce/plata/oro.
    const countOfType = (type, exceptId) =>
        trophies.filter((t) => t.type === type && t.id !== exceptId).length;

    // Esta función se encarga de cambiar el tipo de criterio y reiniciar su valor al
    // criterio por defecto correspondiente.
    const handleCriteriaTypeChange = (trophy, criteriatype) => {
        updateTrophy(trophy.id, { criteriatype, criteria: getDefaultCriteria(criteriatype) });
    };

    return (
        <div className="trophy-editor">
            <div className="trophy-editor__header">
                <span className="trophy-editor__title">Trofeos del laboratorio</span>
                <button
                    type="button"
                    className="trophy-editor__add"
                    onClick={addTrophy}
                    disabled={trophies.length >= MAX_CUSTOM_TROPHIES}
                >
                    Añadir trofeo
                </button>
            </div>

            <p className="trophy-editor__summary">
                Trofeos propios {trophies.length}/{MAX_CUSTOM_TROPHIES}
                {' · '}Bronce {countOfType(0)}/{MAX_TROPHIES_BY_TYPE[0]}
                {' · '}Plata {countOfType(1)}/{MAX_TROPHIES_BY_TYPE[1]}
                {' · '}Oro {countOfType(2)}/{MAX_TROPHIES_BY_TYPE[2]}
            </p>

            <div className="trophy-editor__list">
                {/* Automatic trophy: every lab has it, nothing to edit */}
                <div className="trophy-editor__card trophy-editor__card--auto">
                    <div className="trophy-editor__card-top">
                        <span className="trophy-editor__chip trophy-editor__chip--bronze trophy-editor__chip--active trophy-editor__chip--static">
                            <span className="trophy-editor__dot" />
                            Bronce
                        </span>
                        <span className="trophy-editor__auto-badge">Automático</span>
                    </div>
                    <p className="trophy-editor__auto-name">{COMPLETION_TROPHY.name}</p>
                    <p className="trophy-editor__hint">
                        Se otorga a quien resuelve el laboratorio. Todos los laboratorios lo incluyen.
                    </p>
                </div>

                {/* Una tarjeta editable por cada trofeo personalizado definido */}
                {trophies.map((trophy, index) => {
                    const errors = errorList[index];

                    return (
                        <div key={trophy.id} className="trophy-editor__card">
                            <div className="trophy-editor__card-top">
                                <span className="trophy-editor__card-title">Trofeo {index + 1}</span>
                                <button
                                    type="button"
                                    className="trophy-editor__remove"
                                    onClick={() => removeTrophy(trophy.id)}
                                    aria-label={`Eliminar trofeo ${index + 1}`}
                                >
                                    ×
                                </button>
                            </div>

                            <div className="trophy-editor__chips" role="group" aria-label="Tipo de trofeo">
                                {/* Botones de tipo (bronce/plata/oro): se deshabilitan si el cupo de ese tipo está lleno */}
                                {[0, 1, 2].map((type) => {
                                    const isActive = trophy.type === type;
                                    const isFull = countOfType(type, trophy.id) >= MAX_TROPHIES_BY_TYPE[type];

                                    return (
                                        <button
                                            key={type}
                                            type="button"
                                            aria-pressed={isActive}
                                            disabled={isFull && !isActive}
                                            className={`trophy-editor__chip trophy-editor__chip--${TYPE_CLASS[type]} ${
                                                isActive ? 'trophy-editor__chip--active' : ''
                                            }`}
                                            onClick={() => updateTrophy(trophy.id, { type })}
                                        >
                                            <span className="trophy-editor__dot" />
                                            {TROPHY_TYPE_LABELS[type]}
                                        </button>
                                    );
                                })}
                            </div>

                            <label className="trophy-editor__field">
                                <span className="trophy-editor__label">Nombre</span>
                                <input
                                    type="text"
                                    className="trophy-editor__input"
                                    maxLength={TROPHY_NAME_MAX}
                                    autoComplete="off"
                                    value={trophy.name}
                                    onChange={(e) => updateTrophy(trophy.id, { name: e.target.value })}
                                    onBlur={() => touch(trophy.id, 'name')}
                                />
                                <span className="trophy-editor__counter">
                                    {trophy.name.length}/{TROPHY_NAME_MAX}
                                </span>
                            </label>
                            {isShown(trophy.id, 'name') && errors.name && (
                                <p className="nebula-error">{errors.name}</p>
                            )}

                            <label className="trophy-editor__field">
                                <span className="trophy-editor__label">Descripción</span>
                                <input
                                    type="text"
                                    className="trophy-editor__input"
                                    maxLength={TROPHY_DESC_MAX}
                                    autoComplete="off"
                                    value={trophy.description}
                                    onChange={(e) => updateTrophy(trophy.id, { description: e.target.value })}
                                    onBlur={() => touch(trophy.id, 'description')}
                                />
                                <span className="trophy-editor__counter">
                                    {trophy.description.length}/{TROPHY_DESC_MAX}
                                </span>
                            </label>
                            {isShown(trophy.id, 'description') && errors.description && (
                                <p className="nebula-error">{errors.description}</p>
                            )}

                            <label className="trophy-editor__field">
                                <span className="trophy-editor__label">Criterio</span>
                                <select
                                    className="trophy-editor__select"
                                    value={trophy.criteriatype}
                                    onChange={(e) => handleCriteriaTypeChange(trophy, e.target.value)}
                                >
                                    {Object.entries(CRITERIA_TYPES).map(([key, rule]) => (
                                        <option key={key} value={key} disabled={!rule.available}>
                                            {rule.label}{rule.available ? '' : ' (próximamente)'}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            {/* Según el tipo de criterio elegido, muestra el editor correspondiente */}
                            {trophy.criteriatype === 'time' && (
                                <TimeCriteria
                                    value={trophy.criteria}
                                    onChange={(criteria) => updateTrophy(trophy.id, { criteria })}
                                    onBlur={() => touch(trophy.id, 'criteria')}
                                />
                            )}
                            {trophy.criteriatype === 'failed_attempts' && (
                                <AttemptsCriteria
                                    value={trophy.criteria}
                                    onChange={(criteria) => updateTrophy(trophy.id, { criteria })}
                                    onBlur={() => touch(trophy.id, 'criteria')}
                                />
                            )}
                            {FRAGMENT_CRITERIA.includes(trophy.criteriatype) && (
                                <FragmentsCriteria
                                    kind={trophy.criteriatype}
                                    value={trophy.criteria}
                                    onChange={(criteria) => updateTrophy(trophy.id, { criteria })}
                                    onBlur={() => touch(trophy.id, 'criteria')}
                                />
                            )}
                            {isShown(trophy.id, 'criteria') && errors.criteria && (
                                <p className="nebula-error">{errors.criteria}</p>
                            )}
                        </div>
                    );
                })}
            </div>

            {trophies.length === 0 && (
                <p className="trophy-editor__hint">
                    Opcional: añade hasta {MAX_CUSTOM_TROPHIES} trofeos propios para retar a los estudiantes.
                </p>
            )}

            <p className="nebula-error">{error}</p>
        </div>
    );
}

export default TrophiesEditor;