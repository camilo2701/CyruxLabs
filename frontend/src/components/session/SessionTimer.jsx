// Este archivo se encarga del temporizador de la sesión: muestra el tiempo transcurrido, actualizándolo
// cada segundo mientras la sesión está activa y congelándolo cuando termina o está en pausa.
import { useEffect, useState } from 'react';
import { formatElapsed } from '../../utils/formatElapsed.js';
import styles from '../../styles/Session.module.css';

// Este componente se encarga de calcular y mostrar el tiempo transcurrido de la sesión.
function SessionTimer({ startTime, finishTime, isEnded }) {
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    // Este hook se encarga de mantener actualizado el tiempo: lo fija si la sesión terminó, o lo refresca
    // cada segundo con un intervalo mientras sigue en marcha.
    useEffect(() => {
        if (!startTime) return;

        // Frozen: the session ended, or a stop / flag check is in progress
        if (finishTime || isEnded) {
            const end = finishTime ?? new Date();
            setElapsedSeconds((end.getTime() - startTime.getTime()) / 1000);
            return;
        }

        const tick = () => setElapsedSeconds((Date.now() - startTime.getTime()) / 1000);
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [startTime, isEnded, finishTime]);

    return (
        <div className={styles['sidebar-timer']}>
            <h1>Timer: {formatElapsed(elapsedSeconds)}</h1>
        </div>
    );
}

export default SessionTimer;