// Este archivo se encarga de dibujar un medidor visual de dificultad del laboratorio,
// representado como barras tipo señal que se encienden según el puntaje (tier).
import styles from '../styles/ScoreMeter.module.css';
import { SCORE_TIERS } from '../utils/labRules.js';

// Five bars that rise like a signal icon. A lab lights up as many bars as its tier number
// (100 = 1 bar ... 500 = 5 bars), so difficulty can be read at a glance.
// It is decorative: the tier name and points are always written next to it.
// Este componente se encarga de renderizar las cinco barras de dificultad,
// encendiendo tantas como indique el tier del puntaje recibido.
function ScoreMeter({ score, size = 'normal' }) {
    // Busca a qué tier corresponde el puntaje y lo convierte en cantidad de barras
    // a encender (índice + 1); queda en 0 si el puntaje no coincide con ningún tier
    const level = SCORE_TIERS.findIndex((tier) => tier.value === Number(score)) + 1; // 0 when unknown

    return (
        <span
            className={`${styles.meter} ${size === 'small' ? styles.small : ''}`}
            aria-hidden="true"
        >
            {SCORE_TIERS.map((tier, i) => (
                <span
                    key={tier.value}
                    className={i < level ? `${styles.bar} ${styles.on}` : styles.bar}
                />
            ))}
        </span>
    );
}

export default ScoreMeter;
