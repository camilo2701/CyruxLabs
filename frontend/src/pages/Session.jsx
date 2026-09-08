import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useConfirm } from '../components/ConfirmContext.jsx';
import SuccessModal from '../components/SuccessModal.jsx';
import { useAuth } from '../context/AuthContext';
import styles from '../styles/Session.module.css'

const UNLOAD_WARNING_ENABLED = false; // TODO: re-enable once real hosting removes the self-signed cert workflow

function formatElapsed(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return hh > 0 ? `${pad(hh)}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`;
}

function Session() {
    const { sessionid } = useParams();
    const { token } = useAuth();
    const navigate = useNavigate();
    const confirm = useConfirm();

    const [labid, setLabid] = useState(null);
    const [port, setPort] = useState(null);
    const [protocol, setProtocol] = useState(null);
    const [labTitle, setLabTitle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [flag, setFlag] = useState('');
    const [submittingFlag, setSubmittingFlag] = useState(false);
    const [isEnded, setIsEnded] = useState(false);
    const [isSolved, setIsSolved] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const stopCleanupCount = useRef(0);

    const [startTime, setStartTime] = useState(null);
    const [finishTime, setFinishTime] = useState(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    const iframeUrl = port ? `${protocol}://10.10.0.11:${port}/` : null;

    useEffect(() => {
        if (!token || !sessionid) return;

        fetch(`http://localhost:4000/api/sessions/${sessionid}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(async (res) => {
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'No se pudo cargar la sesión');
                return data.session;
            })
            .then((session) => {
                setLabid(session.labid);
                setPort(session.port);
                setProtocol(session.protocol);
                setLabTitle(session.lab?.title ?? null);
                setIsEnded(session.iscompleted);
                setIsSolved(session.issolved);
                setStartTime(session.starttime ? new Date(session.starttime) : null);
                setFinishTime(session.finishtime ? new Date(session.finishtime) : null);
            })
            .catch((err) => {
                console.error('Failed to load session:', err);
                setLoadError(err.message);
            })
            .finally(() => setLoading(false));
    }, [sessionid, token]);

    useEffect(() => {
        if (!startTime) return;

        if (isEnded) {
            const end = finishTime ?? new Date();
            setElapsedSeconds((end.getTime() - startTime.getTime()) / 1000);
            return;
        }

        const tick = () => setElapsedSeconds((Date.now() - startTime.getTime()) / 1000);
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [startTime, isEnded, finishTime]);

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (!sessionid) return;

            const data = new Blob(
                [JSON.stringify({ sessionid })],
                { type: 'application/json' }
            );
            navigator.sendBeacon('http://localhost:4000/api/sessions/stop', data);

            e.preventDefault();
            e.returnValue = '';
        };

        if (UNLOAD_WARNING_ENABLED) {
            window.addEventListener('beforeunload', handleBeforeUnload);
        }

        return () => {
            if (UNLOAD_WARNING_ENABLED) {
                window.removeEventListener('beforeunload', handleBeforeUnload);
            }

            stopCleanupCount.current += 1;
            if (stopCleanupCount.current < 2) return;

            if (sessionid) {
                fetch('http://localhost:4000/api/sessions/stop', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ sessionid }),
                }).catch(() => {});
            }
        };
    }, [sessionid, token]);

    const handleStopLab = async () => {
        const ok = await confirm({
            title: '¿Terminar laboratorio?',
            message: 'Esta acción cerrará tu sesión actual y no podrás continuar desde donde ibas.',
            confirmText: 'Sí, terminar',
            cancelText: 'Seguir en el lab',
        });
        if (!ok) return;

        fetch('http://localhost:4000/api/sessions/stop', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ sessionid }),
        })
            .catch((err) => console.error('Failed to stop lab:', err))
            .finally(() => navigate('/labs'));
    };

    const handleRestartLab = async () => {
        const ok = await confirm({
            title: '¿Reiniciar laboratorio?',
            message: 'Perderás cualquier progreso o cambio realizado dentro del laboratorio actual.',
            confirmText: 'Sí, reiniciar',
            cancelText: 'Cancelar',
        });
        if (!ok) return;

        try {
            const response = await fetch('http://localhost:4000/api/sessions/restart', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ labid, sessionid }),
            });
            const result = await response.json();

            if (!response.ok) {
                console.error('Failed to restart lab:', result);
                return;
            }

            setPort(result.port);
            setStartTime(result.starttime ? new Date(result.starttime) : new Date());
            setFinishTime(null);
        } catch (err) {
            console.error('Network error restarting lab:', err);
        }
    };

    const handleSubmitFlag = async () => {
        if (!flag.trim() || submittingFlag) return;
        setSubmittingFlag(true);

        try {
            const response = await fetch('http://localhost:4000/api/sessions/submit-flag', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ sessionid, flag }),
            });
            const result = await response.json();

            if (!response.ok || !result.matched) {
                await confirm({
                    title: 'Flag incorrecta',
                    message: 'Esa no es la flag correcta para este laboratorio. Intenta de nuevo.',
                    confirmText: 'Entendido',
                });
                return;
            }

            setIsEnded(true);
            setIsSolved(true);
            setFinishTime(new Date());
            setShowSuccessModal(true);
        } catch (err) {
            console.error('Network error submitting flag:', err);
            await confirm({
                title: 'Error de conexión',
                message: 'No se pudo enviar la flag. Intenta de nuevo.',
                confirmText: 'Entendido',
            });
        } finally {
            setSubmittingFlag(false);
        }
    };

    if (loading) {
        return <div className={styles.page}>Cargando sesión...</div>;
    }

    if (loadError) {
        return <div className={styles.page}>No tienes acceso a esta sesión.</div>;
    }

    return (
        <div className={styles.page}>
            <section className={styles.sidebar}>
                <div className={styles['sidebar-labels']}>
                    <h1>{labTitle ?? 'Lab Title'}</h1>
                    <div className={styles['sidebar-instructions']}>
                        <h2>Instructions</h2>
                        <ul>
                            <li>ins 1</li>
                            <li>ins 1</li>
                            <li>ins 1</li>
                            <li>ins 1</li>
                            <li>ins 1</li>
                            <li>ins 1</li>
                            <li>ins 1</li>
                            <li>ins 1</li>
                            <li>ins 1</li>
                            <li>ins 1</li>
                            <li>ins 1</li>
                            <li>ins 1</li>
                        </ul>
                    </div>
                </div>

                <div className={styles['sidebar-controls']}>

                    <div className={styles['sidebar-controls-buttons']}>
                        <button onClick={handleRestartLab} disabled={isEnded}>Reiniciar Lab</button>

                        <button onClick={handleStopLab} disabled={isEnded}>Terminar Lab</button>
                    </div>

                    <div className={styles['nebula-input']}>
                        <input
                            required
                            type="text"
                            name="flag"
                            autoComplete="off"
                            className={styles.input}
                            value={flag}
                            onChange={(e) => setFlag(e.target.value)}
                            disabled={isEnded}
                        />
                        <label className={styles['user-label']}>Ingresa tu flag</label>
                        <div className={styles['nebula-particle']} style={{ "--x": 0.2, "--y": -0.4, "--delay": "0.1s" }} />
                        <div className={styles['nebula-particle']} style={{ "--x": 0.5, "--y": -0.2, "--delay": "0.3s" }} />
                        <div className={styles['nebula-particle']} style={{ "--x": 0.3, "--y": 0.3, "--delay": "0.5s" }} />
                        <div className={styles['nebula-particle']} style={{ "--x": 0.7, "--y": 0.1, "--delay": "0.2s" }} />
                        <div className={styles['nebula-particle']} style={{ "--x": 0.1, "--y": -0.7, "--delay": "0.4s" }} />
                        <div className={styles['nebula-particle']} style={{ "--x": 0.6, "--y": 0.4, "--delay": "0.6s" }} />
                    </div>

                    <div className={styles['sidebar-controls-buttons']}>
                        <button onClick={handleSubmitFlag} disabled={isEnded || submittingFlag}>
                            {submittingFlag ? 'Enviando...' : 'Enviar Flag'}
                        </button>
                    </div>

                </div>

                <div className={styles['sidebar-timer']}>
                    <h1>Timer: {formatElapsed(elapsedSeconds)}</h1>
                </div>

            </section>

            <section className={styles.desktop}>
                {isSolved ? (
                    <div className={`${styles.congrats} ${styles['congrats--solved']}`}>
                        <h1>¡Felicidades!</h1>
                        <p>Completaste {labTitle ?? 'este laboratorio'} en {formatElapsed(elapsedSeconds)}.</p>
                        <button onClick={() => navigate('/labs')}>Volver a laboratorios</button>
                    </div>
                ) : isEnded ? (
                    <div className={`${styles.congrats} ${styles['congrats--ended']}`}>
                        <h1>Sesión finalizada</h1>
                        <p>Esta sesión ya no está activa.</p>
                        <button onClick={() => navigate('/labs')}>Volver a laboratorios</button>
                    </div>
                ) : (
                    iframeUrl && <iframe src={iframeUrl} allow="autoplay; microphone; camera; clipboard-read; clipboard-write; screen-wake-lock"/>
                )}
            </section>

            {showSuccessModal && (
                <SuccessModal
                    message={`¡Correcto! Completaste ${labTitle ?? 'el laboratorio'} en ${formatElapsed(elapsedSeconds)}.`}
                    onClose={() => setShowSuccessModal(false)}
                />
            )}
        </div>
    )
}

export default Session