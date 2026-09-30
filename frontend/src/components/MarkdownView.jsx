import { memo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import styles from '../styles/MarkdownView.module.css';

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

function CodeBlock({ children }) {
    const preRef = useRef(null);
    const [copied, setCopied] = useState(false);

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

function MarkdownView({ markdown, withHeadingIds = false, allowImages = false }) {
    return (
        <div className={styles.markdown}>
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