import { useState } from 'react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from '../styles/LabsPage.module.css'

import Footer from '../components/Footer.jsx'

function LabsPage(){

    const [query, setQuery] = useState("");
    const [labs, setLabs] = useState([]);
    const [selectedLab, setSelectedLab] = useState(null);

    useEffect(() => {
        fetch('http://localhost:4000/api/labs')
            .then((res) => res.json())
            .then((data) => {
                setLabs(data);
                if (data.length > 0) setSelectedLab(data[0]);
            })
            .catch((err) => console.error('Failed to fetch labs:', err));
    }, []);

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
                                {labs
                                    .filter((lab) => lab.title.toLowerCase().includes(query.toLowerCase()))
                                    .map((lab) => (
                                        <li
                                            key={lab.labid}
                                            onClick={() => setSelectedLab(lab)}
                                            className={selectedLab?.labid === lab.labid ? styles['lab-selected'] : ''}
                                        >
                                            {lab.title}
                                        </li>
                                    ))}
                            </ul>
                        </div>
                        
                    </div>
                    <div className={styles['lab-selection']}>
                        <div className={styles['lab-selection-nav']}>
                            <h2>{selectedLab?.title}</h2>
                            <div className={styles['lab-selection-nav-btn']}><button>Comenzar</button></div>
                        </div>
                        <div className={styles['lab-selection-summary']}>
                            <h3>Introducción</h3>
                            <p>{selectedLab?.description}</p>
                            <h3>Qué ganarás haciendo este lab?</h3>
                            <ul>
                                {selectedLab?.benefit.map((b, i) => (
                                    <li key={i}>{b.description}</li>
                                ))}
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