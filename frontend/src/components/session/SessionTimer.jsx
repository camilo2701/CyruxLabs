import { useEffect, useState } from 'react';
import { formatElapsed } from '../../utils/formatElapsed.js';
import styles from '../../styles/Session.module.css';

function SessionTimer({ startTime, finishTime, isEnded }) {
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

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