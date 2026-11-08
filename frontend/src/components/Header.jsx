// Este archivo se encarga de la barra de navegación superior del sitio, incluyendo
// el menú desplegable de usuario con su animación de entrada/salida.
import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from '../styles/Header.module.css'

// Debe coincidir con la duración de transition en .userMenuDropdown (CSS).
const MENU_ANIMATION_MS = 180;

// Este componente se encarga de renderizar el header con los enlaces de navegación
// y el menú de usuario (perfil, dashboard, cerrar sesión) cuando hay sesión iniciada.
function Header({ onLoginClick }){
    const { user, isAuthenticated, logout } = useAuth();

    // isMenuOpen: estado "lógico" (abierto/cerrado), controla la animación.
    // isMenuRendered: si el dropdown sigue montado en el DOM (para poder
    // animar la salida antes de desmontarlo).
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isMenuRendered, setIsMenuRendered] = useState(false);
    const menuRef = useRef(null);
    const closeTimeoutRef = useRef(null);

    // Esta función se encarga de abrir el menú: lo monta y luego activa la
    // animación de entrada en el siguiente frame.
    const openMenu = () => {
        clearTimeout(closeTimeoutRef.current);
        setIsMenuRendered(true);
        // requestAnimationFrame para que el navegador registre el estado
        // "cerrado" antes de pasar a "abierto" y así sí anime la entrada.
        requestAnimationFrame(() => setIsMenuOpen(true));
    };

    // Esta función se encarga de cerrar el menú: lanza la animación de salida y
    // recién lo desmonta del DOM cuando termina la transición.
    const closeMenu = () => {
        setIsMenuOpen(false);
        closeTimeoutRef.current = setTimeout(() => {
            setIsMenuRendered(false);
        }, MENU_ANIMATION_MS);
    };

    // Esta función se encarga de alternar el menú entre abierto y cerrado.
    const toggleMenu = () => {
        if (isMenuOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    };

    // Este useEffect se encarga de cerrar el menú cuando se hace clic fuera de él.
    useEffect(() => {
        function handleClickOutside(event) {
            if (isMenuOpen && menuRef.current && !menuRef.current.contains(event.target)) {
                closeMenu();
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMenuOpen]);

    // Limpia el timeout pendiente si el componente se desmonta.
    useEffect(() => {
        return () => clearTimeout(closeTimeoutRef.current);
    }, []);

    // Esta función se encarga de cerrar la sesión y redirigir al inicio.
    const handleLogout = () => {
        logout();
        // href (en vez de navigate) hace la redirección Y el refresh
        // de la página en un solo paso, como pediste.
        window.location.href = '/';
    };

    return(
        <header>
            <nav className={styles.nav}>
                <div className={styles.logo}>CyruxLabs</div>
                <ul className={styles['nav-links']}>
                    <li><Link to="/">Inicio</Link></li>
                    <li><Link to="/labs">Laboratorios</Link></li>
                    <li><Link to="/docs">Docs</Link></li>
                </ul>
                <div className={styles.btns}>
                    {isAuthenticated ? (
                        <div className={styles.userMenu} ref={menuRef}>
                            <button
                                type="button"
                                className={`${styles.btn} ${styles.userMenuTrigger}`}
                                onClick={toggleMenu}
                                aria-expanded={isMenuOpen}
                            >
                                <span className={styles.userName}>{user?.username}</span>
                                <span className={styles.userMenuIcon}>☰</span>
                            </button>

                            {isMenuRendered && (
                                <div
                                    className={`${styles.userMenuDropdown} ${
                                        isMenuOpen ? styles.userMenuDropdownOpen : ''
                                    }`}
                                >
                                    <Link
                                        to="/perfil"
                                        className={styles.userMenuItem}
                                        onClick={closeMenu}
                                    >
                                        Perfil
                                    </Link>

                                    <Link
                                        to="/dashboard"
                                        className={styles.userMenuItem}
                                        onClick={closeMenu}
                                    >
                                        Dashboard
                                    </Link>

                                    <button
                                        type="button"
                                        className={`${styles.userMenuItem} ${styles.userMenuLogout}`}
                                        onClick={handleLogout}
                                    >
                                        Cerrar sesión
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button className={styles.btn} onClick={onLoginClick}>
                            Iniciar Sesión
                        </button>
                    )}
                </div>
            </nav>
        </header>
    );
}

export default Header