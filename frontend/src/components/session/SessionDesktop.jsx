import TrophyIcon from '../TrophyIcon.jsx';
import { formatElapsed } from '../../utils/formatElapsed.js';
import styles from '../../styles/Session.module.css';

function SessionDesktop({ isSolved, isEnded, labTitle, totalSeconds, iframeUrl, trophies = [], onBack }) {
    return (
        <section className={styles.desktop}>
            {isSolved ? (
                <div className={`${styles.congrats} ${styles['congrats--solved']}`}>
                    <h1>¡Felicidades!</h1>
                    <p>Completaste {labTitle ?? 'este laboratorio'} en {formatElapsed(totalSeconds)}.</p>

                    {trophies.length > 0 && (
                        <div className={styles['congrats-trophies']}>
                            <h2>Trofeos desbloqueados</h2>
                            <ul>
                                {trophies.map((trophy, index) => (
                                    <li key={`${trophy.name}-${index}`} className={styles['congrats-trophy']}>
                                        <TrophyIcon
                                            type={trophy.type}
                                            size={26}
                                            className={styles['congrats-trophy-icon']}
                                        />
                                        <div>
                                            <strong>{trophy.name}</strong>
                                            <p>{trophy.description}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <button onClick={onBack}>Volver a laboratorios</button>
                </div>
            ) : isEnded ? (
                <div className={`${styles.congrats} ${styles['congrats--ended']}`}>
                    <h1>Sesión finalizada</h1>
                    <p>Esta sesión ya no está activa.</p>
                    <button onClick={onBack}>Volver a laboratorios</button>
                </div>
            ) : (
                iframeUrl && <iframe src={iframeUrl} allow="autoplay; microphone; camera; clipboard-read; clipboard-write; screen-wake-lock"/>
            )}
        </section>
    );
}

export default SessionDesktop;