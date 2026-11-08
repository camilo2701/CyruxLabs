// Este archivo se encarga del selector de dificultad/puntaje del laboratorio, mostrado como tarjetas de radio.
import styles from '../../../styles/ScoreField.module.css';
import ScoreMeter from '../../ScoreMeter.jsx';
import { SCORE_TIERS, getScoreTier } from '../../../utils/labRules.js';

// Esta constante se encarga del texto de ayuda por defecto cuando aún no se eligió una dificultad.
const DEFAULT_HINT = 'El puntaje indica qué tan difícil es el laboratorio y cuántos puntos vale.';


// Este componente se encarga de mostrar las cinco tarjetas de dificultad (radios reales) y avisar el cambio al padre.
function ScoreField({ value, onChange, error }) {
    // Nivel actualmente seleccionado según el puntaje; sirve para mostrar su descripción
    const selectedTier = getScoreTier(value);

    return (
        <fieldset className={styles.field}>
            <legend className={styles.legend}>Dificultad y puntaje</legend>

            {/* Una tarjeta por cada nivel de dificultad disponible */}
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
