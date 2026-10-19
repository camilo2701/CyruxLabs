import ScoreMeter from '../../ScoreMeter.jsx';
import { TITLE_MAX, DESC_MAX, BENEFIT_MAX, MIN_BENEFITS, MAX_BENEFITS, getScoreTier } from '../../../utils/labRules.js';

// "General" tab: title, description and benefits can be edited. The score is only shown:
// the XP students earn comes from it, so changing it later would make everybody's XP inconsistent.
function LabGeneralSection({ editor }) {
  const {
    title, setTitle, validateTitle,
    description, setDescription, validateDescription,
    existingBenefits, newBenefits, benefitInput, setBenefitInput,
    addBenefit, removeExistingBenefit, removeNewBenefit, validateBenefitCount,
    errors, detail,
  } = editor;

  const tier = getScoreTier(detail?.score);
  const benefitCount = existingBenefits.length + newBenefits.length;

  const handleBenefitKeyDown = (event) => {
    if (event.key !== 'Enter') return;

    event.preventDefault();
    const trimmed = benefitInput.trim();
    if (trimmed === '') return;

    if (addBenefit(trimmed)) setBenefitInput('');
  };

  return (
    <div className="lvm-grid">

      <div className="lvm-column">

        <div className="lvm-field">
          <label className="lvm-label" htmlFor="lvm-title">Título</label>
          <input
            id="lvm-title"
            type="text"
            className={`lvm-input${errors.title ? ' lvm-input--error' : ''}`}
            maxLength={TITLE_MAX}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => validateTitle()}
          />
          <div className="lvm-field-footer">
            <span className="lvm-error">{errors.title}</span>
            <span className="lvm-counter">{title.length}/{TITLE_MAX}</span>
          </div>
        </div>

        <div className="lvm-field">
          <label className="lvm-label" htmlFor="lvm-description">Descripción</label>
          <textarea
            id="lvm-description"
            className={`lvm-input lvm-textarea${errors.description ? ' lvm-input--error' : ''}`}
            maxLength={DESC_MAX}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={() => validateDescription()}
          />
          <div className="lvm-field-footer">
            <span className="lvm-error">{errors.description}</span>
            <span className="lvm-counter">{description.length}/{DESC_MAX}</span>
          </div>
        </div>

      </div>

      <div className="lvm-column">

        <div className="lvm-field">
          <label className="lvm-label" htmlFor="lvm-benefit">
            Beneficios ({benefitCount}/{MAX_BENEFITS}, mínimo {MIN_BENEFITS})
          </label>
          <input
            id="lvm-benefit"
            type="text"
            className={`lvm-input${errors.benefits ? ' lvm-input--error' : ''}`}
            maxLength={BENEFIT_MAX}
            placeholder="Escribe un beneficio y presiona Enter"
            value={benefitInput}
            onChange={(event) => setBenefitInput(event.target.value)}
            onKeyDown={handleBenefitKeyDown}
            onBlur={validateBenefitCount}
          />
          <div className="lvm-field-footer">
            <span className="lvm-error">{errors.benefits}</span>
          </div>

          <div className="lvm-tags">
            {existingBenefits.map((benefit) => (
              <span key={benefit.benefitid} className="lvm-tag">
                {benefit.description}
                <button
                  type="button"
                  aria-label={`Quitar beneficio ${benefit.description}`}
                  onClick={() => removeExistingBenefit(benefit.benefitid)}
                >
                  ×
                </button>
              </span>
            ))}

            {newBenefits.map((benefit, index) => (
              <span key={`new-${index}`} className="lvm-tag lvm-tag--new">
                {benefit}
                <button
                  type="button"
                  aria-label={`Quitar beneficio ${benefit}`}
                  onClick={() => removeNewBenefit(index)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="lvm-score">
          <span className="lvm-label">Dificultad y puntaje</span>

          {tier ? (
            <div className="lvm-score-row">
              <ScoreMeter score={detail.score} />
              <span className="lvm-score-name">{tier.label}</span>
              <span className="lvm-score-points">{detail.score} pts</span>
            </div>
          ) : (
            <span className="lvm-hint">Sin puntaje</span>
          )}

          <p className="lvm-hint">
            No se puede cambiar después de crear el laboratorio: de él depende la experiencia (XP)
            que ganan los estudiantes.
          </p>
        </div>

      </div>

    </div>
  );
}

export default LabGeneralSection;
