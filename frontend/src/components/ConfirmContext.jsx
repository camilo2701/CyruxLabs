// Este archivo se encarga de ofrecer un sistema de diálogos de confirmación
// reutilizable mediante Context: expone una función confirm() que devuelve una
// promesa y muestra un modal, evitando tener que montar un diálogo en cada vista.
import { createContext, useContext, useState, useCallback } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

// Esta constante se encarga de crear el contexto que compartirá la función confirm().
const ConfirmContext = createContext(null);

// Este componente se encarga de proveer el contexto de confirmación y de renderizar
// el diálogo cuando hay una confirmación pendiente.
export function ConfirmProvider({ children }) {
    // Guarda las opciones del diálogo activo (título, mensaje, resolve); null = sin diálogo.
    const [dialogState, setDialogState] = useState(null);

    // Esta función se encarga de abrir el diálogo y devolver una promesa que se
    // resolverá con true/false según lo que elija el usuario.
    const confirm = useCallback((options) => {
        return new Promise((resolve) => {
            // Guarda las opciones junto con resolve para poder responder la promesa luego.
            setDialogState({ ...options, resolve });
        });
    }, []);

    // Esta función se encarga de resolver la promesa con true y cerrar el diálogo.
    const handleConfirm = () => {
        dialogState.resolve(true);
        setDialogState(null);
    };

    // Esta función se encarga de resolver la promesa con false y cerrar el diálogo.
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

// Este hook se encarga de dar acceso a la función confirm() desde cualquier componente.
export function useConfirm() {
    return useContext(ConfirmContext);
}