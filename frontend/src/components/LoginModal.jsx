import styles from '../styles/LoginModal.module.css'
import { Link } from 'react-router-dom'
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function LoginModal({ onClose }) {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event){
        event.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'No se pudo iniciar sesión');
                return;
            }

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
                        
                        {error && <p className={styles['card-error']}>{error}</p>}

                        <button type="submit" className={styles.submitBtn} disabled={loading}>
                            {loading ? 'Ingresando...' : 'Continuar'}
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