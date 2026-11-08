// Este archivo se encarga de mostrar un diálogo modal genérico de confirmación,
// reutilizable para pedirle al usuario que confirme o cancele una acción.
import styles from '../styles/ConfirmDialog.module.css';

// Este componente se encarga de renderizar un modal de confirmación con título,
// mensaje y botones de confirmar/cancelar configurables.
function ConfirmDialog({ title, message, confirmText = 'Confirmar', cancelText, onConfirm, onCancel }) {
    return (
        // El clic en el fondo oscuro cancela; stopPropagation evita que un clic
        // dentro de la caja se propague al fondo y cierre el modal sin querer
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