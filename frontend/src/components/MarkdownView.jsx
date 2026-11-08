// Este archivo se encarga de renderizar contenido Markdown de forma segura y con estilos propios:
// enlaces controlados, bloques de código con botón de copiar, tablas con scroll y resaltado de sintaxis.
import { memo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import styles from '../styles/MarkdownView.module.css';

// Este componente se encarga de renderizar los enlaces del Markdown: los anclas internas (#) se abren
// en la misma página y el resto en una pestaña nueva de forma segura.
function MarkdownLink({ href, children }) {
    const isAnchor = href?.startsWith('#');

    if (isAnchor) {
        return <a href={href}>{children}</a>;
    }

    return (
        <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
        </a>
    );
}

// Este componente se encarga de renderizar un bloque de código con un botón para copiar su contenido.
function CodeBlock({ children }) {
    const preRef = useRef(null);
    const [copied, setCopied] = useState(false);

    // Esta función se encarga de copiar el texto del bloque al portapapeles y mostrar "Copiado" brevemente.
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(preRef.current?.innerText ?? '');
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    };

    return (
        <div className={styles['code-block']}>
            <button type="button" className={styles['copy-btn']} onClick={handleCopy}>
                {copied ? 'Copiado' : 'Copiar'}
            </button>
            <pre ref={preRef}>{children}</pre>
        </div>
    );
}

// Este componente se encarga de envolver las tablas en un contenedor con scroll horizontal.
function MarkdownTable({ children }) {
    return (
        <div className={styles['table-wrap']}>
            <table>{children}</table>
        </div>
    );
}

// Defined outside the component so their identity is stable between renders
const remarkPlugins = [remarkGfm];
const rehypePluginsWithIds = [rehypeSlug, rehypeHighlight];
const rehypePluginsPlain = [rehypeHighlight];

const baseComponents = {
    a: MarkdownLink,
    pre: CodeBlock,
    table: MarkdownTable,
};
const noImageComponents = { ...baseComponents, img: () => null };

// Este componente se encarga de renderizar el Markdown recibido aplicando los plugins y componentes
// personalizados, con opciones para IDs en los títulos, permitir imágenes y modo compacto.
function MarkdownView({ markdown, withHeadingIds = false, allowImages = false, compact = false }) {
    return (
        <div className={`${styles.markdown} ${compact ? styles.compact : ''}`}>
            <ReactMarkdown
                remarkPlugins={remarkPlugins}
                rehypePlugins={withHeadingIds ? rehypePluginsWithIds : rehypePluginsPlain}
                components={allowImages ? baseComponents : noImageComponents}
            >
                {markdown ?? ''}
            </ReactMarkdown>
        </div>
    );
}

// memo: Session re-renders every second (timer); skip re-parsing unless props change
export default memo(MarkdownView);