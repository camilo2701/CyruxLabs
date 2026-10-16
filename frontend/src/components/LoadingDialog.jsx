import { useState, useEffect } from 'react';
import confirmStyles from '../styles/ConfirmDialog.module.css';
import styles from '../styles/LoadingDialog.module.css';

// What the runner is doing, in the order it happens. The bar only moves between phases;
// inside the long "building" phase the shimmer shows that it is still working.
const PHASES = {
    preparing: { progress: 12, label: 'Preparando los archivos del laboratorio...' },
    building: { progress: 40, label: 'Descargando y construyendo las imágenes. La primera vez puede tardar varios minutos.' },
    starting: { progress: 80, label: 'Arrancando los contenedores...' },
    finalizing: { progress: 95, label: 'Últimos ajustes...' },
};

function formatSeconds(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function LoadingDialog({ title, phase, startedAt, cancelling, onCancel }) {
    const [now, setNow] = useState(Date.now());

    // Re-renders once a second so the elapsed time keeps moving
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const current = PHASES[phase] ?? PHASES.preparing;
    const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));

    // No onClick on the overlay (unlike ConfirmDialog): clicking outside must not cancel a build
    return (
        <div className={confirmStyles['modal-overlay']}>
            <div className={confirmStyles['modal-box']} role="dialog" aria-live="polite">
                <h3 className={confirmStyles['modal-title']}>{title}</h3>
                <p className={confirmStyles['modal-message']}>
                    {cancelling ? 'Cancelando...' : current.label}
                </p>

                <div
                    className={styles['progress-track']}
                    role="progressbar"
                    aria-label="Progreso del inicio del laboratorio"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={current.progress}
                >
                    <div className={styles['progress-fill']} style={{ width: `${current.progress}%` }} />
                </div>

                <p className={styles['progress-elapsed']}>Tiempo transcurrido: {formatSeconds(elapsedSeconds)}</p>

                <div className={confirmStyles['modal-actions']}>
                    <button
                        className={confirmStyles['modal-btn-cancel']}
                        onClick={onCancel}
                        disabled={cancelling}
                    >
                        {cancelling ? 'Cancelando...' : 'Cancelar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default LoadingDialog;
