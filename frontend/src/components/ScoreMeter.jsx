import styles from '../styles/ScoreMeter.module.css';
import { SCORE_TIERS } from '../utils/labRules.js';

// Five bars that rise like a signal icon. A lab lights up as many bars as its tier number
// (100 = 1 bar ... 500 = 5 bars), so difficulty can be read at a glance.
// It is decorative: the tier name and points are always written next to it.
function ScoreMeter({ score, size = 'normal' }) {
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
