import styles from '../styles/LoginModal.module.css'
import { Link } from 'react-router-dom'
import { useState } from 'react';

function LoginModal({ onClose }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    function handleSubmit(event){
        event.preventDefault();

        console.log(`Logging in with ${email} and ${password}`)
    }

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <button className={styles.closeBtn} onClick={onClose}>✕</button>
                
                <h2>Iniciar Sesión</h2>

                <form>
                    <div className={styles['modal-input']}>
                        <div className={styles['nebula-input']}>
                            <input required type="text" name="email" autoComplete="off" className={styles['input']} />
                            <label className={styles['user-label']}>Email</label>
                            <div className={styles['nebula-particle']} style={{ "--x": 0.2, "--y": -0.4, "--delay": "0.1s" }} />
                            <div className={styles['nebula-particle']} style={{ "--x": 0.5, "--y": -0.2, "--delay": "0.3s" }} />
                            <div className={styles['nebula-particle']} style={{ "--x": 0.3, "--y": 0.3, "--delay": "0.5s" }} />
                            <div className={styles['nebula-particle']} style={{ "--x": 0.7, "--y": 0.1, "--delay": "0.2s" }} />
                            <div className={styles['nebula-particle']} style={{ "--x": 0.1, "--y": -0.7, "--delay": "0.4s" }} />
                            <div className={styles['nebula-particle']} style={{ "--x": 0.6, "--y": 0.4, "--delay": "0.6s" }} />
                        </div>

                        <div className={styles['nebula-input']}>
                            <input required type="text" name="password" autoComplete="off" className={styles['input']} />
                            <label className={styles['user-label']}>Password</label>
                            <div className={styles['nebula-particle']} style={{ "--x": 0.2, "--y": -0.4, "--delay": "0.1s" }} />
                            <div className={styles['nebula-particle']} style={{ "--x": 0.5, "--y": -0.2, "--delay": "0.3s" }} />
                            <div className={styles['nebula-particle']} style={{ "--x": 0.3, "--y": 0.3, "--delay": "0.5s" }} />
                            <div className={styles['nebula-particle']} style={{ "--x": 0.7, "--y": 0.1, "--delay": "0.2s" }} />
                            <div className={styles['nebula-particle']} style={{ "--x": 0.1, "--y": -0.7, "--delay": "0.4s" }} />
                            <div className={styles['nebula-particle']} style={{ "--x": 0.6, "--y": 0.4, "--delay": "0.6s" }} />
                        </div>
                        
                        <button type="submit" className={styles.submitBtn}>
                            Continuar
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