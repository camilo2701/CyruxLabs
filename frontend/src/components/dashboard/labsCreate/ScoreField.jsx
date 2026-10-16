import styles from '../../../styles/ScoreField.module.css';
import ScoreMeter from '../../ScoreMeter.jsx';
import { SCORE_TIERS, getScoreTier } from '../../../utils/labRules.js';

const DEFAULT_HINT = 'El puntaje indica qué tan difícil es el laboratorio y cuántos puntos vale.';

// Five cards, one per difficulty tier. They are real radio buttons underneath, so the
// keyboard (Tab + arrow keys) and screen readers work without extra code.
function ScoreField({ value, onChange, error }) {
    const selectedTier = getScoreTier(value);

    return (
        <fieldset className={styles.field}>
            <legend className={styles.legend}>Dificultad y puntaje</legend>

            <div className={styles.tiers}>
                {SCORE_TIERS.map((tier) => (
                    <label key={tier.value} className={styles.tier}>
                        <input
                            type="radio"
                            name="score"
                            value={tier.value}
                            checked={value === tier.value}
                            onChange={() => onChange(tier.value)}
                            className={styles.radio}
                        />
                        <span className={styles.card}>
                            <ScoreMeter score={tier.value} />
                            <span className={styles.name}>{tier.label}</span>
                            <span className={styles.points}>{tier.value} pts</span>
                        </span>
                    </label>
                ))}
            </div>

            <p className={styles.hint}>
                {selectedTier ? selectedTier.description : DEFAULT_HINT}
            </p>
            {error && <p className={styles.error} role="alert">{error}</p>}
        </fieldset>
    );
}

export default ScoreField;
