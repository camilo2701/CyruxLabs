import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from '../styles/RegisterPage.module.css'
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function RegisterPage() {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [usernameError, setUsernameError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [firstNameError, setFirstNameError] = useState('');
    const [lastNameError, setLastNameError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [repeatPasswordError, setRepeatPasswordError] = useState('');
    const [serverError, setServerError] = useState('');
    const [loading, setLoading] = useState(false);
    

    function formatCheck(valueType){
        const usernameRegex = /^[a-zA-Z0-9.-]{1,12}$/;
        const singleNameRegex = /^\p{L}+$/u;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const specificEmailRegex = /^user@example\.com$/i; /*TO BE USED IN THE FUTURE*/
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,20}$/;

        switch(valueType){
            case 0:
                if (!usernameRegex.test(username)){
                    setUsernameError('Solo letras, números, puntos y guiones (máx 12)');
                    return false;
                }
                else{
                    setUsernameError('');
                    return true;
                }
            case 1:
                if (!singleNameRegex.test(firstName) ){
                    setFirstNameError('Solo letras y sin espacios');
                    return false;
                }
                else{
                    setFirstNameError('');
                    return true;
                }

                break;
            case 2:
                if (!emailRegex.test(email)){
                    setEmailError('Formato de correo inválido');
                    return false;
                }
                else{
                    setEmailError('');
                    return true;
                }

                break;
            case 3:
                if (!passwordRegex.test(password)){
                    setPasswordError('La contraseña debe contener al menos 1 caracter especial, 1 Mayús y 1 número');
                    return false;
                }
                else{
                    setPasswordError('');
                    return true;
                }
            case 4:
                if (password !== confirmPassword){
                    setRepeatPasswordError('Las contraseñas no coinciden');
                    return false;
                }
                else{
                    setRepeatPasswordError('');
                    return true;
                }
            case 5:
                if (!singleNameRegex.test(lastName)){
                    setLastNameError('Solo letras y sin espacios');
                    return false;
                } else {
                    setLastNameError('');
                    return true;
                }
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setServerError('');

        const isUsernameValid = formatCheck(0);
        const isNameValid = formatCheck(1) && formatCheck(5);
        const isEmailValid = formatCheck(2);
        const isPasswordValid = formatCheck(3);
        const isConfirmValid = formatCheck(4);

        const allValid = isUsernameValid && isNameValid && isEmailValid && isPasswordValid && isConfirmValid;

        if (!allValid) {
            return; // stop here, don't submit — at least one field failed
        }

        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, firstName, lastName, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                setServerError(data.error || 'No se pudo completar el registro');
                return;
            }

            login({ token: data.token, user: data.user });
            navigate('/');
        } catch (err) {
            setServerError('No se pudo conectar con el servidor');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h2>Crea una Cuenta</h2>

                <form onSubmit={handleSubmit} className={styles['form-input']}>
                    <div className={styles['nebula-input']}>
                        <input
                            required
                            type="text"
                            name="username"
                            autoComplete="off"
                            className={styles.input}
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            onBlur={(e) => formatCheck(0,e.target.value)}
                        />
                        <label className={styles['user-label']}>Nombre de Usuario</label>
                        <label className={styles['card-error']}>{usernameError}</label>
                    </div>
                    <div className={styles['nebula-input']}>
                        <input
                            required
                            type="text"
                            name="email"
                            autoComplete="off"
                            className={styles.input}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onBlur={(e) => formatCheck(2)}
                        />
                        <label className={styles['user-label']}>Email</label>
                        <label className={styles['card-error']}>{emailError}</label>
                    </div>

                    <div className={styles['nebula-input']}>
                        <input
                            required
                            type="text"
                            name="firstName"
                            autoComplete="off"
                            className={styles.input}
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            onBlur={(e) => formatCheck(1)}
                        />
                        <label className={styles['user-label']}>Nombre</label>
                        <label className={styles['card-error']}>{firstNameError}</label>
                    </div>

                    <div className={styles['nebula-input']}>
                        <input
                            required
                            type="text"
                            name="lastName"
                            autoComplete="off"
                            className={styles.input}
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            onBlur={(e) => formatCheck(5)}
                        />
                        <label className={styles['user-label']}>Apellido</label>
                        <label className={styles['card-error']}>{lastNameError}</label>
                    </div>

                    <div className={styles['nebula-input']}>
                        <input
                            required
                            type="password"
                            name="password"
                            autoComplete="off"
                            className={styles.input}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onBlur={(e) => formatCheck(3)}
                        />
                        <label className={styles['user-label']}>Contraseña</label>
                        <label className={styles['card-error']}>{passwordError}</label>
                    </div>

                    <div className={styles['nebula-input']}>
                        <input
                            required
                            type="password"
                            name="confirmPassword"
                            autoComplete="off"
                            className={styles.input}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            onBlur={(e) => formatCheck(4)}
                        />
                        <label className={styles['user-label']}>Confirmar Contraseña</label>
                        <label className={styles['card-error']}>{repeatPasswordError}</label>
                    </div>

                    {serverError && <label className={styles['card-error']}>{serverError}</label>}

                    <button type="submit" className={styles.submitBtn} disabled={loading}>
                        {loading ? 'Registrando...' : 'Registrarse'}
                    </button>

                </form>

                <p>
                    ¿Ya tienes cuenta? <Link className={styles['modal-link']} to="/">Inicia Sesión</Link>
                </p>
            </div>
        </div>
    );
}

export default RegisterPage