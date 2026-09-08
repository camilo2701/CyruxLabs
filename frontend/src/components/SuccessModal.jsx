import styles from '../styles/SuccessModal.module.css';

function SuccessModal({ message, onClose }) {
    return (
        <div className={styles['modal-overlay']} onClick={onClose}>
            <div className={styles['modal-box']} onClick={(e) => e.stopPropagation()}>
                <button className={styles['modal-close-btn']} onClick={onClose}>×</button>
                <svg width="256px" height="256px" viewBox="-102.4 -102.4 716.80 716.80" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" fill="#000000"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <title>success-filled</title> <g id="Page-1" stroke="none" strokeWidth="1" fill="none" fillRule="evenodd"> <g id="add-copy-2" fill="#00ff00" transform="translate(42.666667, 42.666667)"> <path d="M213.333333,3.55271368e-14 C95.51296,3.55271368e-14 3.55271368e-14,95.51296 3.55271368e-14,213.333333 C3.55271368e-14,331.153707 95.51296,426.666667 213.333333,426.666667 C331.153707,426.666667 426.666667,331.153707 426.666667,213.333333 C426.666667,95.51296 331.153707,3.55271368e-14 213.333333,3.55271368e-14 Z M293.669333,137.114453 L323.835947,167.281067 L192,299.66912 L112.916693,220.585813 L143.083307,190.4192 L192,239.335893 L293.669333,137.114453 Z" id="Shape"> </path> </g> </g> </g></svg>
                <p className={styles['modal-message']}>{message}</p>
            </div>
        </div>
    );
}

export default SuccessModal;