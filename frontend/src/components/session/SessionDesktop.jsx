import TrophyIcon from '../TrophyIcon.jsx';
import { formatElapsed } from '../../utils/formatElapsed.js';
import styles from '../../styles/Session.module.css';
import stateStyles from '../../styles/SessionStates.module.css';

// The unlocked trophies box, shared by every screen that can show trophies
function TrophyList({ trophies }) {
    if (trophies.length === 0) return null;

    return (
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
                        <div className={styles['congrats-trophy-text']}>
                            <strong>{trophy.name}</strong>
                            <p>{trophy.description}</p>
                        </div>
                        {trophy.xp > 0 && (
                            <span className={styles['congrats-trophy-xp']}>+{trophy.xp} XP</span>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

// What the session gave in XP: the lab, the trophies, the total and the level
function XpSummary({ xp }) {
    if (!xp) return null;

    const labNote = xp.reason === 'already_solved'
        ? 'Ya lo habías resuelto antes'
        : xp.reason === 'own_lab' ? 'Es un laboratorio tuyo' : null;

    // Nothing earned and nothing to explain
    if (xp.earned === 0 && !labNote) return null;

    return (
        <div className={styles['congrats-xp']}>
            <h2>Experiencia</h2>

            {(xp.lab > 0 || labNote) && (
                <div className={styles['congrats-xp-row']}>
                    <span>Laboratorio</span>
                    <span>{xp.lab > 0 ? `+${xp.lab} XP` : labNote}</span>
                </div>
            )}

            {xp.trophies > 0 && (
                <div className={styles['congrats-xp-row']}>
                    <span>Trofeos</span>
                    <span>+{xp.trophies} XP</span>
                </div>
            )}

            {xp.earned > 0 && (
                <>
                    <div className={`${styles['congrats-xp-row']} ${styles['congrats-xp-row--total']}`}>
                        <span>Total ganado</span>
                        <span>+{xp.earned} XP</span>
                    </div>
                    <div className={`${styles['congrats-xp-row']} ${styles['congrats-xp-row--muted']}`}>
                        <span>Nivel {xp.level}</span>
                        <span>{xp.total} XP</span>
                    </div>
                </>
            )}

            {xp.leveledUp && (
                <div className={styles['congrats-xp-levelup']}>¡Subiste al nivel {xp.level}!</div>
            )}
        </div>
    );
}

// A screen that only says "wait": the lab is restarting, closing or its flag is being checked
function BusyScreen({ title, children }) {
    return (
        <div
            className={`${styles.congrats} ${styles['congrats--ended']} ${stateStyles.busy}`}
            role="status"
            aria-live="polite"
        >
            <div className={stateStyles.spinner} aria-hidden="true" />
            <h1>{title}</h1>
            <p>{children}</p>
        </div>
    );
}

// What the right-hand side shows, chosen by the session page (see "view" there):
//   running     the lab itself
//   checking    a flag was sent and the answer is pending (if it is right, the lab is closed right after).
//               The iframe stays in the page but hidden, so a wrong flag does not reload the desktop.
//   restarting  waiting for the new lab
//   stopping    waiting while the student's "Terminar Lab" is processed
//   updating    waiting while an admin's lab update closes the session
//   solved      the student solved the lab
//   stopped     the student ended the lab
//   updated     the session was closed by a lab update
//   ended       the session is over (any other reason)
// Everything except "running" and "checking" leaves the iframe out of the page, so the address of
// the lab runner is not left in the page's HTML once the lab is not being used.
function SessionDesktop({ view, labTitle, totalSeconds, iframeUrl, trophies = [], xp = null, onBack }) {
    return (
        <section className={styles.desktop}>
            {(view === 'running' || view === 'checking') && iframeUrl && (
                <iframe
                    src={iframeUrl}
                    style={view === 'checking' ? { display: 'none' } : undefined}
                    allow="autoplay; microphone; camera; clipboard-read; clipboard-write; screen-wake-lock"
                />
            )}

            {view === 'checking' && (
                <BusyScreen title="Verificando flag">
                    Estamos comprobando tu flag. Si es correcta, guardaremos tu progreso y cerraremos el entorno.
                </BusyScreen>
            )}

            {view === 'restarting' && (
                <BusyScreen title="Reiniciando laboratorio">
                    Estamos preparando un entorno nuevo desde cero. Esto puede tardar un momento.
                </BusyScreen>
            )}

            {view === 'stopping' && (
                <BusyScreen title="Terminando laboratorio">
                    Estamos guardando tu progreso y cerrando el entorno.
                </BusyScreen>
            )}

            {view === 'updating' && (
                <BusyScreen title="Actualizando laboratorio">
                    Este laboratorio se está actualizando y tu sesión se está cerrando. Estamos guardando tus trofeos.
                </BusyScreen>
            )}

            {view === 'solved' && (
                <div className={`${styles.congrats} ${styles['congrats--solved']}`}>
                    <h1>¡Felicidades!</h1>
                    <p>Completaste {labTitle ?? 'este laboratorio'} en {formatElapsed(totalSeconds)}.</p>

                    <XpSummary xp={xp} />
                    <TrophyList trophies={trophies} />

                    <button onClick={onBack}>Volver a laboratorios</button>
                </div>
            )}

            {view === 'stopped' && (
                <div className={`${styles.congrats} ${styles['congrats--ended']}`}>
                    <h1>Laboratorio terminado</h1>
                    <p>Terminaste {labTitle ?? 'el laboratorio'} después de {formatElapsed(totalSeconds)}.</p>

                    <XpSummary xp={xp} />
                    <TrophyList trophies={trophies} />

                    <button onClick={onBack}>Volver a laboratorios</button>
                </div>
            )}

            {view === 'updated' && (
                <div className={`${styles.congrats} ${styles['congrats--ended']} ${stateStyles.updated}`}>
                    <h1>Laboratorio actualizado</h1>
                    <p>
                        Tu sesión terminó porque {labTitle ?? 'el laboratorio'} se actualizó. Tu progreso en esta
                        sesión no se conserva, pero puedes volver a iniciarlo desde la lista de laboratorios.
                    </p>

                    <TrophyList trophies={trophies} />

                    <button onClick={onBack}>Volver a laboratorios</button>
                </div>
            )}

            {view === 'ended' && (
                <div className={`${styles.congrats} ${styles['congrats--ended']}`}>
                    <h1>Sesión finalizada</h1>
                    <p>Esta sesión ya no está activa.</p>

                    <TrophyList trophies={trophies} />

                    <button onClick={onBack}>Volver a laboratorios</button>
                </div>
            )}
        </section>
    );
}

export default SessionDesktop;
