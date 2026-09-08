import styles from '../styles/ConfirmDialog.module.css';

function ConfirmDialog({ title, message, confirmText = 'Confirmar', cancelText, onConfirm, onCancel }) {
    return (
        <div className={styles['modal-overlay']} onClick={onCancel}>
            <div className={styles['modal-box']} onClick={(e) => e.stopPropagation()}>
                {title && <h3 className={styles['modal-title']}>{title}</h3>}
                <p className={styles['modal-message']}>{message}</p>
                <div className={styles['modal-actions']}>
                    {cancelText && <button className={styles['modal-btn-cancel']} onClick={onCancel}>{cancelText}</button>}
                    <button className={styles['modal-btn-confirm']} onClick={onConfirm}>{confirmText}</button>
                </div>
            </div>
        </div>
    );
}

export default ConfirmDialog;