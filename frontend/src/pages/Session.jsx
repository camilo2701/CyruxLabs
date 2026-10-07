import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useConfirm } from '../components/ConfirmContext.jsx';
import SuccessModal from '../components/SuccessModal.jsx';
import { useAuth } from '../context/AuthContext';
import SessionInstructions from '../components/session/SessionInstructions.jsx';
import SessionControls from '../components/session/SessionControls.jsx';
import SessionTimer from '../components/session/SessionTimer.jsx';
import SessionDesktop from '../components/session/SessionDesktop.jsx';
import BugReportModal from '../components/session/BugReportModal.jsx';
import { formatElapsed } from '../utils/formatElapsed.js';
import styles from '../styles/Session.module.css'

const UNLOAD_WARNING_ENABLED = false; // TODO: re-enable once real hosting removes the self-signed cert workflow

function Session() {
    const { sessionid } = useParams();
    const { token } = useAuth();
    const navigate = useNavigate();
    const confirm = useConfirm();

    const [labid, setLabid] = useState(null);
    const [port, setPort] = useState(null);
    const [protocol, setProtocol] = useState(null);
    const [labTitle, setLabTitle] = useState(null);
    const [instructions, setInstructions] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [flag, setFlag] = useState('');
    const [submittingFlag, setSubmittingFlag] = useState(false);
    const [stopping, setStopping] = useState(false);
    const [unlockedTrophies, setUnlockedTrophies] = useState([]);
    const [isEnded, setIsEnded] = useState(false);
    const [isSolved, setIsSolved] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const stopCleanupCount = useRef(0);

    const [startTime, setStartTime] = useState(null);
    const [finishTime, setFinishTime] = useState(null);

    const iframeUrl = port ? `${protocol}://10.10.0.12:${port}/` : null;

    // Final time for the end screens. While the lab is running, SessionTimer keeps its own clock.
    const totalSeconds = isEnded && startTime
        ? ((finishTime ?? new Date()).getTime() - startTime.getTime()) / 1000
        : 0;

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
                setInstructions(session.lab?.instructions ?? null);
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

        // Stop the clock right away: closing the lab can take several seconds
        setFinishTime(new Date());
        setStopping(true);

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
            message: 'Perderás cualquier progreso o cambio realizado dentro del laboratorio actual y el temporizador volverá a empezar.',
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

            // A restart is a new attempt: the clock starts over
            setPort(result.port);
            setStartTime(result.starttime ? new Date(result.starttime) : new Date());
            setFinishTime(null);
        } catch (err) {
            console.error('Network error restarting lab:', err);
        }
    };

    const handleSubmitReport = async ({ title, description }) => {
        let response;
        try {
            response = await fetch('http://localhost:4000/api/bugreports', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ sessionid, title, description }),
            });
        } catch {
            throw new Error('No se pudo conectar con el servidor.');
        }

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                response.status < 500 && result.message
                    ? result.message
                    : 'No se pudo enviar el reporte. Intenta de nuevo.'
            );
        }

        // Not awaited on purpose: the report modal closes right away and this stays on top
        confirm({
            title: 'Reporte enviado',
            message: 'Gracias por avisarnos. Revisaremos el problema.',
            confirmText: 'Entendido',
        });
    };

    const handleSubmitFlag = async () => {
        if (!flag.trim() || submittingFlag) return;
        setSubmittingFlag(true);

        // Freeze the clock while the flag is checked (a correct flag also starts the teardown)
        const submittedAt = new Date();
        setFinishTime(submittedAt);

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
                setFinishTime(null); // wrong flag: the clock keeps running
                await confirm({
                    title: 'Flag incorrecta',
                    message: 'Esa no es la flag correcta para este laboratorio. Intenta de nuevo.',
                    confirmText: 'Entendido',
                });
                return;
            }

            setIsEnded(true);
            setIsSolved(true);
            setUnlockedTrophies(result.trophies ?? []);
            // Use the exact time the server recorded
            setFinishTime(result.finishtime ? new Date(result.finishtime) : submittedAt);
            setShowSuccessModal(true);
        } catch (err) {
            console.error('Network error submitting flag:', err);
            setFinishTime(null);
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
                <SessionInstructions labTitle={labTitle} instructions={instructions} />

                <SessionControls
                    isEnded={isEnded || stopping}
                    stopping={stopping}
                    flag={flag}
                    onFlagChange={setFlag}
                    submittingFlag={submittingFlag}
                    onRestart={handleRestartLab}
                    onStop={handleStopLab}
                    onReport={() => setShowReportModal(true)}
                    onSubmitFlag={handleSubmitFlag}
                />

                <SessionTimer startTime={startTime} finishTime={finishTime} isEnded={isEnded} />
            </section>

            <SessionDesktop
                isSolved={isSolved}
                isEnded={isEnded}
                labTitle={labTitle}
                totalSeconds={totalSeconds}
                iframeUrl={iframeUrl}
                trophies={unlockedTrophies}
                onBack={() => navigate('/labs')}
            />

            {showSuccessModal && (
                <SuccessModal
                    message="¡Correcto! Resolviste el laboratorio."
                    onClose={() => setShowSuccessModal(false)}
                />
            )}

            {showReportModal && (
                <BugReportModal
                    onSubmit={handleSubmitReport}
                    onClose={() => setShowReportModal(false)}
                />
            )}
        </div>
    )
}

export default Session