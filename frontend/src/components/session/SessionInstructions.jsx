import MarkdownView from '../MarkdownView.jsx';
import styles from '../../styles/Session.module.css';

function SessionInstructions({ labTitle, instructions }) {
    return (
        <div className={styles['sidebar-labels']}>
            <h1>{labTitle ?? 'Lab Title'}</h1>
            <div className={styles['sidebar-instructions']}>
                <h2>Instrucciones</h2>
                <div className={styles['sidebar-instructions-body']}>
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