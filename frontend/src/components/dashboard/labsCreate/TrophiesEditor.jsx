import { useState } from 'react';
import {
    MAX_CUSTOM_TROPHIES,
    MAX_TROPHIES_BY_TYPE,
    TROPHY_TYPE_LABELS,
    TROPHY_NAME_MAX,
    TROPHY_DESC_MAX,
    CRITERIA_TYPES,
    COMPLETION_TROPHY,
    TIME_MAX_SECONDS,
    FAILED_ATTEMPTS_MAX,
    getTrophyErrorList,
} from '../../../utils/labRules.js';

const TYPE_CLASS = { 0: 'bronze', 1: 'silver', 2: 'gold' };
const DEFAULT_CRITERIA = { time: '300', failed_attempts: '0', command: '', process: '' };
const MAX_MINUTES = TIME_MAX_SECONDS / 60;

let nextTrophyId = 1;

// The id only identifies the card in the list; the backend ignores it
function createTrophy() {
    return {
        id: nextTrophyId++,
        type: 0,
        name: '',
        description: '',
        criteriatype: 'time',
        criteria: DEFAULT_CRITERIA.time,
    };
}

function describeTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes} min ${String(seconds).padStart(2, '0')} s`;
}

/* Time criteria: two boxes (minutes, seconds). The value is stored as total seconds. */
function TimeCriteria({ value, onChange, onBlur }) {
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

/* Failed attempts criteria: one number (0 = no mistakes at all) */
function AttemptsCriteria({ value, onChange, onBlur }) {
    const attempts = Number(value) || 0;

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

function TrophiesEditor({ trophies, onChange, showAllErrors, error }) {
    const [touched, setTouched] = useState({});

    const errorList = getTrophyErrorList(trophies);

    const touch = (id, field) => setTouched((prev) => ({ ...prev, [`${id}:${field}`]: true }));
    const isShown = (id, field) => showAllErrors || touched[`${id}:${field}`];

    const updateTrophy = (id, changes) => {
        onChange(trophies.map((t) => (t.id === id ? { ...t, ...changes } : t)));
    };

    const removeTrophy = (id) => onChange(trophies.filter((t) => t.id !== id));

    const addTrophy = () => {
        if (trophies.length < MAX_CUSTOM_TROPHIES) onChange([...trophies, createTrophy()]);
    };

    const countOfType = (type, exceptId) =>
        trophies.filter((t) => t.type === type && t.id !== exceptId).length;

    const handleCriteriaTypeChange = (trophy, criteriatype) => {
        updateTrophy(trophy.id, { criteriatype, criteria: DEFAULT_CRITERIA[criteriatype] ?? '' });
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