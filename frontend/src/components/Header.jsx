import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from '../styles/Header.module.css'

// Debe coincidir con la duración de transition en .userMenuDropdown (CSS).
const MENU_ANIMATION_MS = 180;

function Header({ onLoginClick }){
    const { user, isAuthenticated, logout } = useAuth();

    // isMenuOpen: estado "lógico" (abierto/cerrado), controla la animación.
    // isMenuRendered: si el dropdown sigue montado en el DOM (para poder
    // animar la salida antes de desmontarlo).
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isMenuRendered, setIsMenuRendered] = useState(false);
    const menuRef = useRef(null);
    const closeTimeoutRef = useRef(null);

    const openMenu = () => {
        clearTimeout(closeTimeoutRef.current);
        setIsMenuRendered(true);
        // requestAnimationFrame para que el navegador registre el estado
        // "cerrado" antes de pasar a "abierto" y así sí anime la entrada.
        requestAnimationFrame(() => setIsMenuOpen(true));
    };

    const closeMenu = () => {
        setIsMenuOpen(false);
        closeTimeoutRef.current = setTimeout(() => {
            setIsMenuRendered(false);
        }, MENU_ANIMATION_MS);
    };

    const toggleMenu = () => {
        if (isMenuOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    };

    // Cierra el dropdown (animado) si el usuario hace click fuera de él.
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

    const handleLogout = () => {
        logout();
        // href (en vez de navigate) hace la redirección Y el refresh
        // de la página en un solo paso, como pediste.
        window.location.href = '/';
    };

    return(
        <header>
            <nav>
                <div className={styles.logo}>CyruxLabs</div>
                <ul className={styles['nav-links']}>
                    <li><Link to="/">Inicio</Link></li>
                    <li><Link to="/labs">Laboratorios</Link></li>
                    <li><Link to="/faq">FAQ</Link></li>
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
                                {user?.username}
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