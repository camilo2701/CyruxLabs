import React from "react";
import { Link } from "react-router-dom";
import styles from '../styles/Header.module.css'

function Header({ onLoginClick }){
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
                    <button className={styles.btn} onClick={onLoginClick}>
                        Iniciar Sesión
                    </button>
                </div>
            </nav>
        </header>
    );
}

export default Header