import { createContext, useContext, useState, useCallback } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
    const [dialogState, setDialogState] = useState(null);

    const confirm = useCallback((options) => {
        return new Promise((resolve) => {
            setDialogState({ ...options, resolve });
        });
    }, []);

    const handleConfirm = () => {
        dialogState.resolve(true);
        setDialogState(null);
    };

    const handleCancel = () => {
        dialogState.resolve(false);
        setDialogState(null);
    };

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {dialogState && (
                <ConfirmDialog
                    title={dialogState.title}
                    message={dialogState.message}
                    confirmText={dialogState.confirmText}
                    cancelText={dialogState.cancelText}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                />
            )}
        </ConfirmContext.Provider>
    );
}

export function useConfirm() {
    return useContext(ConfirmContext);
}