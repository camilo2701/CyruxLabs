// Este archivo se encarga del modal de inicio de sesión, incluyendo el bloqueo temporal tras varios intentos fallidos.
import styles from '../styles/LoginModal.module.css'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Esta función se encarga de formatear los segundos restantes del bloqueo como "MM:SS".
function formatCountdown(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Este componente se encarga del formulario del modal de login y de gestionar el estado de bloqueo por intentos fallidos.
function LoginModal({ onClose }) {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [lock, setLock] = useState(null);
    const [secondsLeft, setSecondsLeft] = useState(0);

    // Hay bloqueo activo solo si es para el email escrito ahora y aún quedan segundos
    const isLocked = !!lock && lock.email === email.trim().toLowerCase() && secondsLeft > 0;

    // Este efecto se encarga de llevar la cuenta regresiva del bloqueo y limpiarlo cuando llega a cero.
    useEffect(() => {
        if (!lock) return;

        // Recalcula cada segundo cuánto falta para que termine el bloqueo
        const tick = () => {
            const remaining = Math.max(0, Math.ceil((lock.until - Date.now()) / 1000));
            setSecondsLeft(remaining);
            if (remaining === 0) {
                setLock(null);
                setError('');
            }
        };

        tick();
        const intervalId = setInterval(tick, 1000);
        return () => clearInterval(intervalId);
    }, [lock]);

    // Esta función se encarga de enviar las credenciales al backend y manejar el bloqueo y los errores.
    async function handleSubmit(event){
        event.preventDefault();
        if (isLocked) return;
        setError('');
        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            // Código 423: el backend bloqueó la cuenta e indica cuántos segundos faltan para reintentar
            if (response.status === 423) {
                // cuenta bloqueada, backend envia sgds restantes
                setLock({
                    email: email.trim().toLowerCase(),
                    until: Date.now() + (data.retryAfterSeconds || 0) * 1000,
                });
                setPassword('');
                setError(data.error || 'Acceso bloqueado temporalmente');
                return;
            }

            if (!response.ok) {
                setError(data.error || 'No se pudo iniciar sesión');
                return;
            }

            // Login correcto: guarda la sesión y cierra el modal
            login({ token: data.token, user: data.user });
            onClose();
        } catch (err) {
            setError('No se pudo conectar con el servidor');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <button className={styles.closeBtn} onClick={onClose}>✕</button>
                
                <h2>Iniciar Sesión</h2>

                <form onSubmit={handleSubmit}>
                    <div className={styles['modal-input']}>
                        <div className={styles['nebula-input']}>
                            <input
                                required
                                type="text"
                                name="email"
                                autoComplete="off"
                                className={styles['input']}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            <label className={styles['user-label']}>Email</label>
                            <div className={styles['nebula-particle']} style={{ "--x": 0.2, "--y": -0.4, "--delay": "0.1s" }} />
                            <div className={styles['nebula-particle']} style={{ "--x": 0.5, "--y": -0.2, "--delay": "0.3s" }} />
                            <div className={styles['nebula-particle']} style={{ "--x": 0.3, "--y": 0.3, "--delay": "0.5s" }} />
                            <div className={styles['nebula-particle']} style={{ "--x": 0.7, "--y": 0.1, "--delay": "0.2s" }} />
                            <div className={styles['nebula-particle']} style={{ "--x": 0.1, "--y": -0.7, "--delay": "0.4s" }} />
                            <div className={styles['nebula-particle']} style={{ "--x": 0.6, "--y": 0.4, "--delay": "0.6s" }} />
                        </div>

                        <div className={styles['nebula-input']}>
                            <input
                                required
                                type="password"
                                name="password"
                                autoComplete="off"
                                className={styles['input']}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <label className={styles['user-label']}>Password</label>
                            <div className={styles['nebula-particle']} style={{ "--x": 0.2, "--y": -0.4, "--delay": "0.1s" }} />
                            <div className={styles['nebula-particle']} style={{ "--x": 0.5, "--y": -0.2, "--delay": "0.3s" }} />
                            <div className={styles['nebula-particle']} style={{ "--x": 0.3, "--y": 0.3, "--delay": "0.5s" }} />
                            <div className={styles['nebula-particle']} style={{ "--x": 0.7, "--y": 0.1, "--delay": "0.2s" }} />
                            <div className={styles['nebula-particle']} style={{ "--x": 0.1, "--y": -0.7, "--delay": "0.4s" }} />
                            <div className={styles['nebula-particle']} style={{ "--x": 0.6, "--y": 0.4, "--delay": "0.6s" }} />
                        </div>
                        
                        {/* Si la cuenta está bloqueada muestra la cuenta regresiva; si no, el error normal */}
                        {isLocked ? (
                            <div className={styles['lock-message']} role="alert">
                                <strong>Acceso bloqueado</strong>
                                <span>Superaste los 3 intentos fallidos de inicio de sesión.</span>
                                <span>
                                    Podrás intentarlo de nuevo en{' '}
                                    <span className={styles['lock-countdown']}>{formatCountdown(secondsLeft)}</span>
                                </span>
                            </div>
                        ) : (
                            error && <p className={styles['card-error']}>{error}</p>
                        )}

                        <button type="submit" className={styles.submitBtn} disabled={loading || isLocked}>
                            {loading ? 'Ingresando...' : isLocked ? 'Bloqueado' : 'Continuar'}
                        </button>

                    </div>
                </form>
                <p>
                    ¿No tienes cuenta? <Link className={styles['modal-link']} to="/register" onClick={onClose}>Regístrate</Link>
                </p>
            </div>
        </div>
    );
}


export default LoginModal