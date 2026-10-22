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

// While the lab is running the page asks the server every few seconds whether the session is still
// alive (an admin can close it by applying a lab update). It asks faster while a close is in progress.
const WATCH_MS = 5000;
const WATCH_CLOSING_MS = 2000;

// Sentence added to the success popup, from what the backend says about the XP
function describeXp(xp) {
    if (!xp) return '';
    if (xp.earned > 0) {
        const parts = [];
        if (xp.lab > 0) parts.push(`${xp.lab} por el laboratorio`);
        if (xp.trophies > 0) parts.push(`${xp.trophies} por trofeos`);
        const detail = parts.length > 1 ? ` (${parts.join(' + ')})` : '';
        return ` Ganaste +${xp.earned} XP${detail}${xp.leveledUp ? ` y subiste al nivel ${xp.level}` : ''}.`;
    }
    if (xp.reason === 'already_solved') return ' Ya lo habías resuelto antes, así que no suma XP.';
    if (xp.reason === 'own_lab') return ' Es un laboratorio tuyo, así que no suma XP.';
    return '';
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
    const [instructions, setInstructions] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [flag, setFlag] = useState('');
    const [submittingFlag, setSubmittingFlag] = useState(false);
    const [stopping, setStopping] = useState(false);
    const [restarting, setRestarting] = useState(false);
    const [unlockedTrophies, setUnlockedTrophies] = useState([]);
    // What the session gave in XP (lab + trophies), as the backend reports it; null when unknown or nothing
    const [xp, setXp] = useState(null);
    const [isEnded, setIsEnded] = useState(false);
    const [isSolved, setIsSolved] = useState(false);
    // Why the session ended when it was not by solving the lab:
    // 'stopped' = the student pressed "Terminar Lab", 'updated' = a lab update closed it, null = other reasons
    const [endReason, setEndReason] = useState(null);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const stopCleanupCount = useRef(0);
    // The "lab was updated" dialog is shown once per visit, however many times the server repeats it
    const updateNoticeShown = useRef(false);
    // Refs so the timers and the cleanup below always see the current values without being rebuilt
    const confirmRef = useRef(confirm);
    confirmRef.current = confirm;

    const [startTime, setStartTime] = useState(null);
    const [finishTime, setFinishTime] = useState(null);

    const endedRef = useRef(false);
    endedRef.current = isEnded;

    const iframeUrl = port ? `${protocol}://10.10.0.12:${port}/` : null;

    // Final time for the end screens. While the lab is running, SessionTimer keeps its own clock.
    const totalSeconds = isEnded && startTime
        ? ((finishTime ?? new Date()).getTime() - startTime.getTime()) / 1000
        : 0;

    // What the right-hand side shows. Only 'running' and 'checking' have the lab (the iframe) in the page:
    // in every other state it is gone, so the address of the lab runner is not left there.
    // 'checking' keeps the iframe mounted but hidden, so a wrong flag does not reload the student's desktop.
    let view = 'running';
    if (isSolved) view = 'solved';
    else if (endReason === 'updated') view = isEnded ? 'updated' : 'updating';
    else if (isEnded && endReason === 'stopped') view = 'stopped';
    else if (isEnded) view = 'ended';
    else if (stopping) view = 'stopping';
    else if (restarting) view = 'restarting';
    else if (submittingFlag) view = 'checking';

    const closingForUpdate = view === 'updating';

    /*** THE SESSION ENDED WITHOUT THE STUDENT ASKING ***/

    // An admin applied a lab update while this session was open. The server marks the session as
    // 'updated' first (it is still being closed) and completes it a moment later, with its trophies.
    // notify: show the dialog (false when the page is just opened on a session that already ended that way)
    const handleClosedByUpdate = (session, { notify }) => {
        setEndReason('updated');
        setPort(null);
        setProtocol(null);
        // Freeze the clock now; the server's own time replaces it once the session is completed
        setFinishTime((previous) => (session.finishtime ? new Date(session.finishtime) : (previous ?? new Date())));

        if (notify && !updateNoticeShown.current) {
            updateNoticeShown.current = true;
            // Not awaited on purpose: the page already shows what happened behind this dialog
            confirmRef.current({
                title: 'Laboratorio actualizado',
                message:
                    'Este laboratorio recibió una actualización y tu sesión se cerró. ' +
                    'Tu progreso en esta sesión no se conserva, pero se guardaron los trofeos que ya habías ganado. ' +
                    'Puedes volver a iniciarlo desde la lista de laboratorios.',
                confirmText: 'Entendido',
            });
        }

        if (session.iscompleted) {
            setIsEnded(true);
            setUnlockedTrophies(session.trophies ?? []);
        }
    };

    // The session was closed some other way (another tab, a lab that was no longer running...)
    const handleClosedElsewhere = (session) => {
        setPort(null);
        setProtocol(null);
        setIsSolved(!!session.issolved);
        setFinishTime(session.finishtime ? new Date(session.finishtime) : new Date());
        setUnlockedTrophies(session.trophies ?? []);
        setIsEnded(true);
    };

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
                // An ended session has no lab to show, so its address is not even kept
                setPort(session.iscompleted ? null : session.port);
                setProtocol(session.iscompleted ? null : session.protocol);
                setLabTitle(session.lab?.title ?? null);
                setInstructions(session.lab?.instructions ?? null);
                setIsEnded(session.iscompleted);
                setIsSolved(session.issolved);
                setStartTime(session.starttime ? new Date(session.starttime) : null);
                setFinishTime(session.finishtime ? new Date(session.finishtime) : null);
                setUnlockedTrophies(session.trophies ?? []);

                // Opened a session that a lab update already closed (or is closing right now)
                if (session.startstatus === 'updated') handleClosedByUpdate(session, { notify: false });
            })
            .catch((err) => {
                console.error('Failed to load session:', err);
                setLoadError(err.message);
            })
            .finally(() => setLoading(false));
    }, [sessionid, token]);

    // While the lab is in use, keep an eye on the session. Paused while this page is itself restarting,
    // stopping or checking a flag, so its own actions are never mixed up with what the server says.
    const watching = !!token && !!sessionid && !loading && !loadError
        && !isEnded && !stopping && !restarting && !submittingFlag;

    useEffect(() => {
        if (!watching) return;

        let cancelled = false;

        const check = async () => {
            try {
                const response = await fetch(`http://localhost:4000/api/sessions/${sessionid}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await response.json();
                if (cancelled || !response.ok) return;

                const session = data.session;
                if (session.startstatus === 'updated') handleClosedByUpdate(session, { notify: true });
                else if (session.iscompleted) handleClosedElsewhere(session);
            } catch {
                // No answer this time: the next check tries again
            }
        };

        const timer = setInterval(check, closingForUpdate ? WATCH_CLOSING_MS : WATCH_MS);

        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [watching, closingForUpdate, sessionid, token]);

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

            // A session that already ended has nothing left to stop
            if (endedRef.current) return;

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

        // Stop the clock right away and take the lab off the screen: closing it can take several seconds
        const stoppedAt = new Date();
        setFinishTime(stoppedAt);
        setStopping(true);

        try {
            const response = await fetch('http://localhost:4000/api/sessions/stop', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ sessionid }),
            });
            const result = await response.json().catch(() => ({}));

            if (!response.ok) throw new Error(result.message || 'No se pudo terminar el laboratorio');

            // The student stays here: this page now says the lab was terminated and what was unlocked
            setPort(null);
            setProtocol(null);
            setUnlockedTrophies(result.trophies ?? []);
            setXp(result.xp ?? null);
            setFinishTime(result.finishtime ? new Date(result.finishtime) : stoppedAt);
            setEndReason((previous) => previous ?? 'stopped');
            setIsEnded(true);
        } catch (err) {
            console.error('Failed to stop lab:', err);
            setFinishTime(null); // the lab is still there: the clock keeps running
            await confirm({
                title: 'No se pudo terminar el laboratorio',
                message: 'Ocurrió un problema al cerrar el laboratorio. Inténtalo de nuevo.',
                confirmText: 'Entendido',
            });
        } finally {
            setStopping(false);
        }
    };

    const handleRestartLab = async () => {
        const ok = await confirm({
            title: '¿Reiniciar laboratorio?',
            message: 'Perderás cualquier progreso o cambio realizado dentro del laboratorio actual y el temporizador volverá a empezar.',
            confirmText: 'Sí, reiniciar',
            cancelText: 'Cancelar',
        });
        if (!ok) return;

        // The lab comes off the screen until the new one is ready
        setRestarting(true);

        try {
            const response = await fetch('http://localhost:4000/api/sessions/restart', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ labid, sessionid }),
            });
            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                console.error('Failed to restart lab:', result);
                await confirm({
                    title: 'No se pudo reiniciar el laboratorio',
                    message: 'Ocurrió un problema al reiniciar. Puedes intentarlo de nuevo con «Reiniciar Lab».',
                    confirmText: 'Entendido',
                });
                return;
            }

            // A restart is a new attempt: the clock starts over
            setPort(result.port);
            if (result.protocol) setProtocol(result.protocol);
            setStartTime(result.starttime ? new Date(result.starttime) : new Date());
            setFinishTime(null);
        } catch (err) {
            console.error('Network error restarting lab:', err);
            await confirm({
                title: 'Error de conexión',
                message: 'No se pudo contactar con el servidor para reiniciar el laboratorio. Intenta de nuevo.',
                confirmText: 'Entendido',
            });
        } finally {
            setRestarting(false);
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

            setPort(null);
            setProtocol(null);
            setIsEnded(true);
            setIsSolved(true);
            setUnlockedTrophies(result.trophies ?? []);
            setXp(result.xp ?? null);
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
                    isEnded={isEnded || stopping || restarting || closingForUpdate || submittingFlag}
                    stopping={stopping}
                    restarting={restarting}
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
                view={view}
                labTitle={labTitle}
                totalSeconds={totalSeconds}
                iframeUrl={iframeUrl}
                trophies={unlockedTrophies}
                xp={xp}
                onBack={() => navigate('/labs')}
            />

            {showSuccessModal && (
                <SuccessModal
                    message={`¡Correcto! Resolviste el laboratorio.${describeXp(xp)}`}
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
