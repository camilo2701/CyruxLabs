// Este archivo se encarga del modal para reportar un problema (bug) dentro de un laboratorio:
// recoge título y descripción, valida y envía el reporte, y gestiona estados de envío y error.
import { useState, useEffect } from 'react';
import confirmStyles from '../../styles/ConfirmDialog.module.css';
import styles from '../../styles/BugReportModal.module.css';

// Estas constantes se encargan de limitar la longitud máxima del título y de la descripción.
const TITLE_MAX = 100;
const DESCRIPTION_MAX = 2000;

// Este componente se encarga de renderizar el modal de reporte de problemas y gestionar su envío.
function BugReportModal({ onSubmit, onClose }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Se puede enviar solo si el título y la descripción tienen contenido y no hay un envío en curso.
    const canSubmit =
        title.trim().length > 0 &&
        description.trim().length > 0 &&
        !submitting;

    // Este hook se encarga de cerrar el modal al pulsar Escape (salvo que se esté enviando).
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !submitting) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, submitting]);

    // Esta función se encarga de enviar el reporte (título y descripción recortados) y cerrar el modal,
    // mostrando un mensaje de error si el envío falla.
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canSubmit) return;

        setSubmitting(true);
        setError(null);

        try {
            await onSubmit({
                title: title.trim(),
                description: description.trim(),
            });
            onClose();
        } catch (err) {
            console.error('Failed to send bug report:', err);
            setError('No se pudo enviar el reporte. Intenta de nuevo.');
            setSubmitting(false);
        }
    };

    return (
        <div className={confirmStyles['modal-overlay']}>
            <div
                className={styles.box}
                role="dialog"
                aria-modal="true"
                aria-labelledby="bug-report-title"
            >
                <button
                    type="button"
                    className={confirmStyles['modal-close-btn']}
                    onClick={onClose}
                    disabled={submitting}
                    aria-label="Cerrar"
                >
                    ×
                </button>

                <h2 id="bug-report-title" className={confirmStyles['modal-title']}>
                    Reportar un problema
                </h2>
                <p className={styles.hint}>
                    Describe qué salió mal en este laboratorio para que podamos revisarlo.
                </p>

                <form className={styles.form} onSubmit={handleSubmit}>
                    <label className={styles.field}>
                        <span className={styles.label}>Título</span>
                        <input
                            type="text"
                            className={styles.input}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={TITLE_MAX}
                            placeholder="Ej: La terminal no abre"
                            autoComplete="off"
                            autoFocus
                            disabled={submitting}
                        />
                    </label>

                    <label className={styles.field}>
                        <span className={styles.label}>Descripción</span>
                        <textarea
                            className={styles.textarea}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={DESCRIPTION_MAX}
                            placeholder="¿Qué estabas haciendo, qué esperabas que pasara y qué pasó en realidad?"
                            disabled={submitting}
                        />
                        <span className={styles.counter}>
                            {description.length}/{DESCRIPTION_MAX}
                        </span>
                    </label>

                    {error && (
                        <p className={styles.error} role="alert">{error}</p>
                    )}

                    <div className={`${confirmStyles['modal-actions']} ${styles.actions}`}>
                        <button
                            type="button"
                            className={confirmStyles['modal-btn-cancel']}
                            onClick={onClose}
                            disabled={submitting}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className={confirmStyles['modal-btn-confirm']}
                            disabled={!canSubmit}
                        >
                            {submitting ? 'Enviando...' : 'Enviar reporte'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default BugReportModal;