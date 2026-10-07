import styles from '../../styles/Session.module.css';

function SessionControls({
    isEnded,
    stopping,
    flag,
    onFlagChange,
    submittingFlag,
    onRestart,
    onStop,
    onReport,
    onSubmitFlag,
}) {
    return (
        <div className={styles['sidebar-controls']}>

            <div className={styles['sidebar-controls-buttons']}>
                <button onClick={onRestart} disabled={isEnded}>Reiniciar Lab</button>

                <button onClick={onStop} disabled={isEnded}>{stopping ? 'Terminando...' : 'Terminar Lab'}</button>

                <button
                    type="button"
                    className={styles['icon-btn']}
                    onClick={onReport}
                    title="Reportar un problema"
                    aria-label="Reportar un problema"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/>
                    </svg>
                </button>
            </div>

            <div className={styles['nebula-input']}>
                <input
                    required
                    type="text"
                    name="flag"
                    autoComplete="off"
                    className={styles.input}
                    value={flag}
                    onChange={(e) => onFlagChange(e.target.value)}
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
                <button onClick={onSubmitFlag} disabled={isEnded || submittingFlag}>
                    {submittingFlag ? 'Enviando...' : 'Enviar Flag'}
                </button>
            </div>

        </div>
    );
}

export default SessionControls;