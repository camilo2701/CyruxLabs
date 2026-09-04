import { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from '../styles/LabsPage.module.css'

import Footer from '../components/Footer.jsx'

function LabsPage(){

    const [query, setQuery] = useState("");

    return(
        <>
            <div className={styles['page']}>
                <div className={styles['lab-ui']}>
                    <div className={styles['lab-menu']}>
                        <div className={styles['lab-menu-title']}>
                            <h1>Laboratorios</h1>
                        </div>
                        <div className={styles['lab-menu-search-bar']}>
                            <div className={styles.group}>
                                <svg
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                    className={styles['search-icon']}
                                >
                                    <g>
                                    <path
                                        d="M21.53 20.47l-3.66-3.66C19.195 15.24 20 13.214 20 11c0-4.97-4.03-9-9-9s-9 4.03-9 9 4.03 9 9 9c2.215 0 4.24-.804 5.808-2.13l3.66 3.66c.147.146.34.22.53.22s.385-.073.53-.22c.295-.293.295-.767.002-1.06zM3.5 11c0-4.135 3.365-7.5 7.5-7.5s7.5 3.365 7.5 7.5-3.365 7.5-7.5 7.5-7.5-3.365-7.5-7.5z"
                                    />
                                    </g>
                                </svg>

                                <input
                                    id="query"
                                    className={styles.input}
                                    type="search"
                                    placeholder="Search labs by name..."
                                    name="searchbar"
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                />
                            </div>
                        </div>
                        <div className={styles['lab-menu-scroll']}>
                            <ul className={styles['lab-menu-list']}>
                                <li>SQL Injection #1</li>
                                <li>Stored Cross-Site Scripting</li>
                                <li>Server-Side Request Forgery</li>
                                <li>Command Injection</li>
                                <li>Path Traversal</li>
                                <li>Broken Object Level Authorization</li>
                                <li>Command Injection</li>
                                <li>Path Traversal</li>
                                <li>Command Injection</li>
                                <li>Path Traversal</li>
                            </ul>
                        </div>
                        
                    </div>
                    <div className={styles['lab-selection']}>
                        <div className={styles['lab-selection-nav']}>
                            <h2>SQL Injection #1</h2>
                            <div className={styles['lab-selection-nav-btn']}><button>Comenzar</button></div>
                            
                        </div>
                        <div className={styles['lab-selection-summary']}>
                            <h3>Introducción</h3>
                            <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec non cursus enim. In sagittis non mi eu tempus. Proin ultricies enim sollicitudin odio consequat vulputate. Proin et nisl ex. Suspendisse tincidunt augue tincidunt porttitor pretium. Nunc quis placerat augue. Fusce in pulvinar ante. Nulla pretium elit risus, eu facilisis elit blandit in. Quisque iaculis, neque ut tincidunt pretium, quam lacus congue purus, in convallis dui enim non ligula. Integer ac mi non dui scelerisque pulvinar. Curabitur nisi dolor, dictum a est a, lacinia suscipit risus. </p>
                            <h3>Qué ganarás haciendo este lab?</h3>
                            <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec non cursus enim. In sagittis non mi eu tempus. Proin ultricies enim sollicitudin odio consequat vulputate.</p>
                            <ul>
                                <li>Mauris lectus mi</li>
                                <li>elementum tristique mauris ut, auctor dapibus turpis.</li>
                                <li>Proin lacinia libero erat, eu pharetra lacus ullamcorper quis. </li>
                            </ul>

                        </div>
                        
                    </div>
                </div>
            </div>
            <Footer/>
        </>
    )

}

export default LabsPage