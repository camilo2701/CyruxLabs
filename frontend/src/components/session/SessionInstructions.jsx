// Este archivo se encarga de mostrar el título y las instrucciones del laboratorio en la barra lateral de la sesión.
import MarkdownView from '../MarkdownView.jsx';
import styles from '../../styles/Session.module.css';

// Este componente se encarga de renderizar el título del laboratorio y sus instrucciones (en Markdown),
// o un mensaje de que aún no hay instrucciones.
function SessionInstructions({ labTitle, instructions }) {
    return (
        <div className={styles['sidebar-labels']}>
            <h1>{labTitle ?? 'Lab Title'}</h1>
            <div className={styles['sidebar-instructions']}>
                <h2>Instrucciones</h2>
                <div className={styles['sidebar-instructions-body']}>
                    {/* Si hay instrucciones las muestra en Markdown; si no, un aviso de que faltan */}
                    {instructions ? (
                        <>
                            <MarkdownView markdown={instructions} compact />
                            <p className={styles['sidebar-instructions-end']}>
                                Fin de las instrucciones
                            </p>
                        </>
                    ) : (
                        <p className={styles['sidebar-instructions-empty']}>
                            Este laboratorio aún no tiene instrucciones.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default SessionInstructions;