import { useState } from 'react';
import { useEffect } from 'react';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/LabsPage.module.css'
import Footer from '../components/Footer.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import LoadingDialog from '../components/LoadingDialog.jsx'
import ScoreMeter from '../components/ScoreMeter.jsx'
import { useAuth } from '../context/AuthContext';
import { getScoreTier } from '../utils/labRules.js';

const formatDate = (iso) =>
    iso ? new Date(iso).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' }) : '—';

// How often the page asks how the lab is going, and how many failed asks in a row it tolerates
const POLL_MS = 2000;
const MAX_POLL_ERRORS = 5;

function LabsPage(){
    const [query, setQuery] = useState("");
    const [labs, setLabs] = useState([]);
    const [selectedLab, setSelectedLab] = useState(null);
    // null = nothing starting; otherwise { sessionid, phase, startedAt } and the loading dialog is shown
    // (sessionid is null for the first moments, while the start request is still on its way)
    const [launch, setLaunch] = useState(null);
    const [cancelling, setCancelling] = useState(false);
    // null = no error; otherwise { title, message } and the error dialog is shown
    const [startError, setStartError] = useState(null);
    // A ref keeps its value between renders without causing one: here it remembers
    // "the user pressed Cancelar" even if the start request has not answered yet
    const cancelRequested = useRef(false);
    const navigate = useNavigate();
    const { token, isAuthenticated } = useAuth();

    // Tier (name + points) of the selected lab; null if the lab has no score
    const selectedTier = getScoreTier(selectedLab?.score);

    const showStartError = (title, message) => {
        setLaunch(null);
        setCancelling(false);
        setStartError({ title, message });
    };

    // Ends a session that is still starting (the backend turns this into a real cancel)
    const stopSession = async (sessionid) => {
        try {
            const response = await fetch('http://localhost:4000/api/sessions/stop', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ sessionid }),
            });

            if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                throw new Error(result.message || 'No se pudo cancelar');
            }

            setLaunch(null);
            setCancelling(false);
        } catch (err) {
            console.error('Failed to cancel the start:', err);
            showStartError(
                'No se pudo cancelar',
                'El laboratorio podría seguir iniciándose. Inténtalo de nuevo en unos momentos.'
            );
        }
    };

    const handleComenzar = async () => {
        if (!selectedLab || !isAuthenticated || launch) return;

        setStartError(null);
        setCancelling(false);
        cancelRequested.current = false;
        // The dialog opens right away, so nothing else can be clicked while the lab starts
        setLaunch({ sessionid: null, phase: 'preparing', startedAt: Date.now() });

        try {
            const response = await fetch('http://localhost:4000/api/sessions/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ labid: selectedLab.labid }),
            });

            const result = await response.json();

            if (!response.ok) {
                console.error('Failed to start session:', result);

                // The instructor queued a new zip + flag for this lab: it takes no new sessions until
                // it has been applied. Nothing is broken, so it is not shown as an error.
                if (result.error?.code === 'LAB_UPDATING') {
                    showStartError(
                        'Laboratorio en actualización',
                        result.message || 'Este laboratorio se está actualizando. Podrás iniciarlo de nuevo en unos minutos.'
                    );
                    return;
                }

                showStartError(
                    'No se pudo iniciar el laboratorio',
                    `${result.message || 'Ocurrió un error inesperado.'} Inténtalo de nuevo en unos momentos.`
                );
                return;
            }

            // The user pressed Cancelar before the backend answered: end that session now
            if (cancelRequested.current) {
                await stopSession(result.sessionid);
                return;
            }

            // Already running (for example a lab left open earlier): go straight in
            if (result.startstatus === 'ready') {
                setLaunch(null);
                navigate(`/session/${result.sessionid}`);
                return;
            }

            // Still being built: the effect below follows it until it is ready
            setLaunch((previous) => previous && {
                ...previous,
                sessionid: result.sessionid,
                phase: result.startphase ?? previous.phase,
            });
        } catch (err) {
            console.error('Network error starting session:', err);
            showStartError(
                'Sin conexión con el servidor',
                'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.'
            );
        }
    };

    const handleCancelLaunch = async () => {
        if (!launch || cancelling) return;

        setCancelling(true);
        cancelRequested.current = true;

        // No sessionid yet: the start request is still in flight and will be cancelled when it answers
        if (!launch.sessionid) return;

        await stopSession(launch.sessionid);
    };

    // While a lab is starting, ask the backend how it is going until it is ready, failed or cancelled.
    // It depends on the sessionid only, so changing the phase does not restart the polling.
    const launchSessionId = launch?.sessionid;

    useEffect(() => {
        if (!launchSessionId) return;

        let stopped = false;
        let timer = null;
        let errorsInARow = 0;

        const poll = async () => {
            try {
                const response = await fetch(`http://localhost:4000/api/sessions/${launchSessionId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await response.json();
                if (stopped) return;

                if (!response.ok) throw new Error(data.message || 'No se pudo consultar el estado del laboratorio');

                errorsInARow = 0;
                const session = data.session;

                if (session.startstatus === 'ready') {
                    setLaunch(null);
                    navigate(`/session/${launchSessionId}`);
                    return;
                }

                if (session.startstatus === 'failed') {
                    showStartError(
                        'No se pudo iniciar el laboratorio',
                        `${session.starterror || 'Ocurrió un error inesperado.'} Inténtalo de nuevo.`
                    );
                    return;
                }

                if (session.startstatus === 'cancelled') {
                    setLaunch(null);
                    setCancelling(false);
                    return;
                }

                setLaunch((previous) => (previous ? { ...previous, phase: session.startphase ?? previous.phase } : previous));
            } catch (err) {
                if (stopped) return;
                console.error('Error checking the lab:', err);
                errorsInARow += 1;

                if (errorsInARow >= MAX_POLL_ERRORS) {
                    showStartError(
                        'Sin conexión con el servidor',
                        'Se perdió la conexión mientras se iniciaba el laboratorio. Vuelve a pulsar Comenzar para retomarlo.'
                    );
                    return;
                }
            }

            if (!stopped) timer = setTimeout(poll, POLL_MS);
        };

        poll();

        // Cleanup: stops the polling when the lab is ready, cancelled or the page closes
        return () => {
            stopped = true;
            clearTimeout(timer);
        };
    }, [launchSessionId, token, navigate]);

    useEffect(() => {
        fetch('http://localhost:4000/api/labs?all=true')
            .then((res) => res.json())
            .then((data) => {
                const labsList = data.labs;

                if (!Array.isArray(labsList)) {
                    console.error('Unexpected /api/labs response:', data);
                    return;
                }
                setLabs(labsList);
                if (labsList.length > 0) setSelectedLab(labsList[0]);
            })
            .catch((err) => console.error('Failed to fetch labs:', err));
    }, []);

    return(
        <>
            {launch && (
                <LoadingDialog
                    title="Iniciando laboratorio"
                    phase={launch.phase}
                    startedAt={launch.startedAt}
                    cancelling={cancelling}
                    onCancel={handleCancelLaunch}
                />
            )}
            {startError && (
                <ConfirmDialog
                    title={startError.title}
                    message={startError.message}
                    confirmText="Entendido"
                    onConfirm={() => setStartError(null)}
                    onCancel={() => setStartError(null)}
                />
            )}
            <div className={styles['page']}>
                <div className={styles['lab-ui']}>
                    <div className={styles['lab-menu']}>
                        <div className={styles['lab-menu-title']}>
                            <h1>Laboratorios</h1>
                        </div>
                        <div className={styles['lab-menu-search-bar']}>
                            <div className={styles.group}>
                                <svg
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                    className={styles['search-icon']}
                                >
                                    <g>
                                    <path
                                        d="M21.53 20.47l-3.66-3.66C19.195 15.24 20 13.214 20 11c0-4.97-4.03-9-9-9s-9 4.03-9 9 4.03 9 9 9c2.215 0 4.24-.804 5.808-2.13l3.66 3.66c.147.146.34.22.53.22s.385-.073.53-.22c.295-.293.295-.767.002-1.06zM3.5 11c0-4.135 3.365-7.5 7.5-7.5s7.5 3.365 7.5 7.5-3.365 7.5-7.5 7.5-7.5-3.365-7.5-7.5z"
                                    />
                                    </g>
                                </svg>

                                <input
                                    id="query"
                                    className={styles.input}
                                    type="search"
                                    placeholder="Search labs by name..."
                                    name="searchbar"
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                />
                            </div>
                        </div>
                        <div className={styles['lab-menu-scroll']}>
                            <ul className={styles['lab-menu-list']}>
                                {labs
                                    .filter((lab) => lab.title.toLowerCase().includes(query.toLowerCase()))
                                    .map((lab) => (
                                        <li
                                            key={lab.labid}
                                            onClick={() => setSelectedLab(lab)}
                                            className={selectedLab?.labid === lab.labid ? styles['lab-selected'] : ''}
                                        >
                                            <span className={styles['lab-menu-item-title']}>{lab.title}</span>
                                            {getScoreTier(lab.score) && (
                                                <span className={styles['lab-menu-item-score']}>
                                                    <ScoreMeter score={lab.score} size="small" />
                                                    {lab.score}
                                                </span>
                                            )}
                                        </li>
                                    ))}
                            </ul>
                        </div>

                    </div>
                    <div className={styles['lab-selection']}>
                        <div className={styles['lab-selection-nav']}>
                            <div className={styles['lab-selection-heading']}>
                                <h2>{selectedLab?.title}</h2>
                                {selectedLab?.dateofupdate && (
                                    <span className={styles['lab-updated']}>
                                        Última actualización: {formatDate(selectedLab.dateofupdate)}
                                    </span>
                                )}
                                {selectedTier && (
                                    <div className={styles['score-chip']}>
                                        <ScoreMeter score={selectedLab.score} />
                                        <span>{selectedTier.label}</span>
                                        <span className={styles['score-chip-points']}>{selectedLab.score} pts</span>
                                    </div>
                                )}
                            </div>
                            <div className={styles['lab-selection-nav-btn']}>
                                <button onClick={handleComenzar} disabled={!isAuthenticated || launch !== null}>
                                    {!isAuthenticated
                                        ? 'Inicia sesión para comenzar'
                                        : launch
                                            ? 'Iniciando...'
                                            : 'Comenzar'}
                                </button>
                            </div>
                        </div>
                        <div className={styles['lab-selection-summary']}>
                            <h3>Introducción</h3>
                            <p>{selectedLab?.description}</p>
                            <h3>Qué ganarás haciendo este lab?</h3>
                            <ul>
                                {(selectedLab?.benefit ?? []).map((b, i) => (
                                    <li key={i}>{b.description}</li>
                                ))}
                            </ul>
                        </div>

                    </div>
                </div>
            </div>
            <Footer/>
        </>
    )

}

export default LabsPage
