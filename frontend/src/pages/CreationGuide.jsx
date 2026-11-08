// Este archivo se encarga de la página de la guía de creación de laboratorios:
// descarga el Markdown desde el backend, lo renderiza y construye un índice
// navegable con resaltado de la sección actual (scroll-spy).
import { useEffect, useMemo, useRef, useState } from 'react';
import GithubSlugger from 'github-slugger';
import MarkdownView from '../components/MarkdownView.jsx';
import Footer from '../components/Footer.jsx';
import styles from '../styles/CreationGuide.module.css';

const GUIDE_URL = 'http://localhost:4000/api/docs/creation-guide';

// Pixels from the top of the viewport at which a section counts as "current"
const ACTIVE_OFFSET = 120;

/* Reads the ## headings straight from the Markdown so the index can never drift
   out of sync with the content. github-slugger is the same algorithm rehype-slug
   uses, so every id here matches the id rendered on the page. */
// Esta función se encarga de extraer los encabezados ## del Markdown para armar
// el índice, generando los mismos ids (slugs) que usa la página al renderizar.
function extractSections(markdown) {
    const slugger = new GithubSlugger();
    const sections = [];
    let inFence = false;

    for (const line of markdown.split('\n')) {
        // Alterna el estado dentro/fuera de un bloque de código (```); así se
        // ignoran los "#" que aparezcan dentro de ejemplos de código
        if (/^\s*(```|~~~)/.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) continue;

        // Detecta cualquier encabezado Markdown (de # a ######) y captura su texto
        const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
        if (!match) continue;

        const text = match[2].replace(/[`*]/g, '');
        // Slug every heading (even ones we don't list) so duplicate counters stay in sync
        const id = slugger.slug(text);

        // Solo los encabezados de nivel 2 (##) entran al índice visible
        if (match[1].length === 2) sections.push({ id, text });
    }

    return sections;
}

// Este componente se encarga de renderizar la lista del índice, marcando como
// activo el enlace de la sección que se está viendo.
function GuideIndex({ sections, activeId, onNavigate }) {
    return (
        <ul className={styles.index}>
            {sections.map((section) => (
                <li key={section.id}>
                    <a
                        href={`#${section.id}`}
                        onClick={(e) => onNavigate(e, section.id)}
                        className={`${styles['index-link']} ${
                            section.id === activeId ? styles['index-link--active'] : ''
                        }`}
                        aria-current={section.id === activeId ? 'location' : undefined}
                    >
                        {section.text}
                    </a>
                </li>
            ))}
        </ul>
    );
}

// Este componente se encarga de la página de la guía: carga el contenido, maneja
// los estados de carga/error y coordina el índice con el scroll.
function CreationGuide() {
    const [markdown, setMarkdown] = useState('');
    const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
    const [activeId, setActiveId] = useState(null);
    const mobileIndexRef = useRef(null);

    // Recalcula las secciones del índice solo cuando cambia el Markdown
    const sections = useMemo(() => extractSections(markdown), [markdown]);

    // Este useEffect se encarga de descargar el Markdown de la guía desde el backend.
    useEffect(() => {
        // Bandera para no actualizar el estado si el componente se desmonta a mitad del fetch
        let cancelled = false;

        fetch(GUIDE_URL)
            .then(async (res) => {
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'No se pudo cargar la guía');
                return data.markdown;
            })
            .then((text) => {
                if (cancelled) return;
                setMarkdown(text);
                setStatus('ready');
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('Failed to load creation guide:', err);
                setStatus('error');
            });

        return () => {
            cancelled = true;
        };
    }, []);

    // Este useEffect se encarga de saltar a la sección indicada en el #hash de la URL
    // una vez que la guía ya cargó.
    // Jump to the right place when the page loads with a #hash in the URL
    useEffect(() => {
        if (status !== 'ready') return;

        let hash = '';
        try {
            hash = decodeURIComponent(window.location.hash.slice(1));
        } catch {
            // malformed hash: ignore it
        }

        if (hash) document.getElementById(hash)?.scrollIntoView();
    }, [status]);

    // Este useEffect se encarga del "scroll-spy": detecta qué sección se está viendo
    // y la marca como activa en el índice mientras el usuario hace scroll.
    // Scroll-spy: the current section is the last ## heading that has reached the top
    useEffect(() => {
        if (status !== 'ready') return;

        let frame = null;

        // Recorre las secciones y toma como "actual" la última cuyo tope ya pasó
        // el umbral superior; corta al llegar a la primera que aún está más abajo
        const updateActive = () => {
            frame = null;
            let current = sections[0]?.id ?? null;

            for (const section of sections) {
                const element = document.getElementById(section.id);
                if (!element) continue;

                if (element.getBoundingClientRect().top <= ACTIVE_OFFSET) {
                    current = section.id;
                } else {
                    break;
                }
            }

            setActiveId(current);
        };

        // Limita el cálculo a un frame por vez con requestAnimationFrame (throttle)
        const handleScroll = () => {
            if (frame === null) frame = requestAnimationFrame(updateActive);
        };

        updateActive();
        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (frame !== null) cancelAnimationFrame(frame);
        };
    }, [status, sections]);

    // Esta función se encarga de navegar a una sección desde el índice: cierra el
    // índice móvil, hace scroll al bloque y actualiza el #hash sin recargar.
    const handleNavigate = (e, id) => {
        e.preventDefault();
        mobileIndexRef.current?.removeAttribute('open');
        document.getElementById(id)?.scrollIntoView({ block: 'start' });
        window.history.replaceState(window.history.state, '', `#${id}`);
    };

    if (status !== 'ready') {
        return (
            <>
                <div className={styles.page}>
                    <div className={styles.content}>
                        <p className={styles.message}>
                            {status === 'loading'
                                ? 'Cargando guía...'
                                : 'No se pudo cargar la guía. Intenta de nuevo más tarde.'}
                        </p>
                    </div>
                </div>
                <Footer />
            </>
        );
    }

    return (
        <>
            <div className={styles.page}>
                <aside className={styles.sidebar}>
                    <div role="navigation" aria-label="Índice de la guía">
                        <p className={styles['sidebar-title']}>Contenido</p>
                        <GuideIndex sections={sections} activeId={activeId} onNavigate={handleNavigate} />
                    </div>
                </aside>

                <div className={styles.content}>
                    <details ref={mobileIndexRef} className={styles['mobile-index']}>
                        <summary>Contenido de la guía</summary>
                        <GuideIndex sections={sections} activeId={activeId} onNavigate={handleNavigate} />
                    </details>

                    <article className={styles.article}>
                        <MarkdownView markdown={markdown} withHeadingIds allowImages />
                    </article>
                </div>
            </div>
            <Footer />
        </>
    );
}

export default CreationGuide;