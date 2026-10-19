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
} from '../../../utils/labRules.js';
import { TimeCriteria, AttemptsCriteria, FragmentsCriteria } from './TrophyCriteriaFields.jsx';

const TYPE_CLASS = { 0: 'bronze', 1: 'silver', 2: 'gold' };

// A fresh value each time, so cards never share the same array
function getDefaultCriteria(criteriatype) {
  if (FRAGMENT_CRITERIA.includes(criteriatype)) return [''];
  return criteriatype === 'failed_attempts' ? '0' : '300';
}

let nextNewTrophy = 1;

// A brand-new trophy. It starts with the first type that still has room, so it is valid from the start.
function createTrophy(trophies) {
  const type = [0, 1, 2].find(
    (candidate) => trophies.filter((trophy) => trophy.type === candidate).length < MAX_TROPHIES_BY_TYPE[candidate]
  ) ?? 0;

  return {
    key: `new-${nextNewTrophy++}`,
    trophyid: null,
    type,
    name: '',
    description: '',
    criteriatype: 'time',
    criteria: getDefaultCriteria('time'),
    earnedCount: 0,
  };
}

// "Trofeos" tab. The rules:
//  - name and description can always be changed
//  - once a student has earned a trophy, its tier, criteria and existence are frozen
//    (otherwise what that student earned would stop meaning what it meant)
//  - new trophies can be added while there is room (they are not given to people retroactively)
function LabTrophiesSection({ editor }) {
  const { trophies, setTrophies, trophyErrorList, showTrophyErrors, errors } = editor;
  const [touched, setTouched] = useState({});

  const touch = (key, field) => setTouched((prev) => ({ ...prev, [`${key}:${field}`]: true }));
  const isShown = (key, field) => showTrophyErrors || touched[`${key}:${field}`];

  const updateTrophy = (key, changes) => {
    setTrophies(trophies.map((trophy) => (trophy.key === key ? { ...trophy, ...changes } : trophy)));
  };

  const removeTrophy = (key) => setTrophies(trophies.filter((trophy) => trophy.key !== key));

  const addTrophy = () => {
    if (trophies.length < MAX_CUSTOM_TROPHIES) setTrophies([...trophies, createTrophy(trophies)]);
  };

  const countOfType = (type, exceptKey) =>
    trophies.filter((trophy) => trophy.type === type && trophy.key !== exceptKey).length;

  const changeCriteriaType = (trophy, criteriatype) => {
    updateTrophy(trophy.key, { criteriatype, criteria: getDefaultCriteria(criteriatype) });
  };

  return (
    <div className="lvm-trophies">
      <div className="lvm-trophies-header">
        <span className="lvm-label lvm-trophies-title">Trofeos del laboratorio</span>
        <button
          type="button"
          className="lvm-button lvm-button--primary"
          onClick={addTrophy}
          disabled={trophies.length >= MAX_CUSTOM_TROPHIES}
        >
          Añadir trofeo
        </button>
      </div>

      <p className="lvm-hint">
        Trofeos propios {trophies.length}/{MAX_CUSTOM_TROPHIES}
        {' · '}Bronce {countOfType(0)}/{MAX_TROPHIES_BY_TYPE[0]}
        {' · '}Plata {countOfType(1)}/{MAX_TROPHIES_BY_TYPE[1]}
        {' · '}Oro {countOfType(2)}/{MAX_TROPHIES_BY_TYPE[2]}
      </p>

      <p className="lvm-hint">
        Si un estudiante ya obtuvo un trofeo, solo podrás cambiar su nombre y descripción: así lo que
        ganó sigue significando lo mismo. Los trofeos nuevos no se entregan con efecto retroactivo.
      </p>

      {errors.trophies && <p className="lvm-error">{errors.trophies}</p>}

      <div className="lvm-trophy-list">
        {/* Automatic trophy: every lab has it, nothing to edit */}
        <div className="lvm-trophy-card lvm-trophy-card--auto">
          <div className="lvm-trophy-top">
            <span className="lvm-chip lvm-chip--bronze lvm-chip--active lvm-chip--static">
              <span className="lvm-dot" />
              Bronce
            </span>
            <span className="lvm-badge">Automático</span>
          </div>
          <p className="lvm-trophy-auto-name">{COMPLETION_TROPHY.name}</p>
          <p className="lvm-hint">
            Se otorga a quien resuelve el laboratorio. Todos los laboratorios lo incluyen.
          </p>
        </div>

        {trophies.map((trophy, index) => {
          const trophyErrors = trophyErrorList[index];
          const locked = trophy.earnedCount > 0;

          return (
            <div key={trophy.key} className="lvm-trophy-card">
              <div className="lvm-trophy-top">
                <span className="lvm-trophy-card-title">Trofeo {index + 1}</span>
                {locked ? (
                  <span className="lvm-badge lvm-badge--locked">
                    Obtenido por {trophy.earnedCount}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="lvm-icon-button"
                    onClick={() => removeTrophy(trophy.key)}
                    aria-label={`Eliminar trofeo ${index + 1}`}
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="lvm-chips" role="group" aria-label="Tipo de trofeo">
                {[0, 1, 2].map((type) => {
                  const isActive = trophy.type === type;
                  const isFull = countOfType(type, trophy.key) >= MAX_TROPHIES_BY_TYPE[type];

                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={isActive}
                      disabled={locked || (isFull && !isActive)}
                      className={`lvm-chip lvm-chip--${TYPE_CLASS[type]}${isActive ? ' lvm-chip--active' : ''}`}
                      onClick={() => updateTrophy(trophy.key, { type })}
                    >
                      <span className="lvm-dot" />
                      {TROPHY_TYPE_LABELS[type]}
                    </button>
                  );
                })}
              </div>
              {isShown(trophy.key, 'type') && trophyErrors.type && (
                <p className="lvm-error">{trophyErrors.type}</p>
              )}

              <label className="lvm-field lvm-field--compact">
                <span className="lvm-label">Nombre</span>
                <input
                  type="text"
                  className="lvm-input lvm-input--compact"
                  maxLength={TROPHY_NAME_MAX}
                  autoComplete="off"
                  value={trophy.name}
                  onChange={(event) => updateTrophy(trophy.key, { name: event.target.value })}
                  onBlur={() => touch(trophy.key, 'name')}
                />
                <span className="lvm-counter">{trophy.name.length}/{TROPHY_NAME_MAX}</span>
              </label>
              {isShown(trophy.key, 'name') && trophyErrors.name && (
                <p className="lvm-error">{trophyErrors.name}</p>
              )}

              <label className="lvm-field lvm-field--compact">
                <span className="lvm-label">Descripción</span>
                <input
                  type="text"
                  className="lvm-input lvm-input--compact"
                  maxLength={TROPHY_DESC_MAX}
                  autoComplete="off"
                  value={trophy.description}
                  onChange={(event) => updateTrophy(trophy.key, { description: event.target.value })}
                  onBlur={() => touch(trophy.key, 'description')}
                />
                <span className="lvm-counter">{trophy.description.length}/{TROPHY_DESC_MAX}</span>
              </label>
              {isShown(trophy.key, 'description') && trophyErrors.description && (
                <p className="lvm-error">{trophyErrors.description}</p>
              )}

              <label className="lvm-field lvm-field--compact">
                <span className="lvm-label">Criterio</span>
                <select
                  className="lvm-input lvm-input--compact"
                  value={trophy.criteriatype}
                  disabled={locked}
                  onChange={(event) => changeCriteriaType(trophy, event.target.value)}
                >
                  {Object.entries(CRITERIA_TYPES).map(([value, rule]) => (
                    <option key={value} value={value} disabled={!rule.available}>
                      {rule.label}{rule.available ? '' : ' (próximamente)'}
                    </option>
                  ))}
                </select>
              </label>

              {trophy.criteriatype === 'time' && (
                <TimeCriteria
                  value={trophy.criteria}
                  disabled={locked}
                  onChange={(criteria) => updateTrophy(trophy.key, { criteria })}
                  onBlur={() => touch(trophy.key, 'criteria')}
                />
              )}
              {trophy.criteriatype === 'failed_attempts' && (
                <AttemptsCriteria
                  value={trophy.criteria}
                  disabled={locked}
                  onChange={(criteria) => updateTrophy(trophy.key, { criteria })}
                  onBlur={() => touch(trophy.key, 'criteria')}
                />
              )}
              {FRAGMENT_CRITERIA.includes(trophy.criteriatype) && (
                <FragmentsCriteria
                  kind={trophy.criteriatype}
                  value={trophy.criteria}
                  disabled={locked}
                  onChange={(criteria) => updateTrophy(trophy.key, { criteria })}
                  onBlur={() => touch(trophy.key, 'criteria')}
                />
              )}
              {isShown(trophy.key, 'criteria') && trophyErrors.criteria && (
                <p className="lvm-error">{trophyErrors.criteria}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LabTrophiesSection;
