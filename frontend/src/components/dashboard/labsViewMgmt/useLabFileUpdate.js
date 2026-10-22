import { useEffect, useState } from 'react';
import { useConfirm } from '../../ConfirmContext.jsx';
import { getFlagError, generateFlag } from '../../../utils/labRules.js';
import { requestFileUpdate, cancelFileUpdate, applyFileUpdateNow } from './labsApi.js';

const MAX_ZIP_SIZE = 50 * 1024 * 1024; // same limit as the backend

// The "Archivo y flag" tab. The zip and the flag always travel together: the flag has to be the one
// hidden inside the new zip. The backend does not apply them right away; it queues them until the lab
// has no open session (see labUpdateService in the backend).
export function useLabFileUpdate({ labid, token, isAdmin, detail, refreshMeta }) {
    const confirm = useConfirm();

    const [file, setFile] = useState(null);
    const [newFlag, setNewFlag] = useState('');
    const [fileError, setFileError] = useState('');
    const [flagError, setFlagError] = useState('');
    const [message, setMessage] = useState(null); // { type: 'error' | 'success', text }
    const [isBusy, setIsBusy] = useState(false);

    const pending = detail?.pendingUpdate ?? null;
    const currentFlag = detail?.flag ?? '';

    // The flag box starts with the lab's current flag: keeping it is valid when only the zip changes
    useEffect(() => {
        if (currentFlag) setNewFlag((previous) => previous || currentFlag);
    }, [currentFlag]);

    // While an update waits, look again every 15 s: reading the lab also lets the backend apply it
    useEffect(() => {
        if (!pending) return undefined;

        const timer = setInterval(refreshMeta, 15_000);
        return () => clearInterval(timer);
    }, [pending, refreshMeta]);

    const chooseFile = (chosen) => {
        if (!chosen) return;

        if (!chosen.name.toLowerCase().endsWith('.zip')) {
            setFile(null);
            setFileError('El archivo debe ser un .zip');
            return;
        }
        if (chosen.size > MAX_ZIP_SIZE) {
            setFile(null);
            setFileError('El archivo supera el límite de 50 MB');
            return;
        }

        setFile(chosen);
        setFileError('');
    };

    const changeFlag = (value) => {
        setNewFlag(value);
        setFlagError('');
    };

    const fillGeneratedFlag = () => {
        setNewFlag(generateFlag());
        setFlagError('');
    };

    const validateFlag = () => setFlagError(getFlagError(newFlag));

    const submit = async () => {
        const nextFlagError = getFlagError(newFlag);
        const nextFileError = file ? '' : 'Elige el archivo .zip nuevo';
        setFlagError(nextFlagError);
        setFileError(nextFileError);
        if (nextFlagError || nextFileError) return;

        const confirmed = await confirm({
            title: '¿Programar la actualización?',
            message:
                'La flag debe coincidir exactamente con la que escondiste dentro del archivo comprimido nuevo. ' +
                'Si no coincide, nadie podrá resolver el laboratorio. ' +
                'Se aplicará cuando no haya sesiones activas de este laboratorio.',
            confirmText: 'Sí, programar',
            cancelText: 'Cancelar',
        });
        if (!confirmed) return;

        setIsBusy(true);
        setMessage(null);

        try {
            const { ok, data } = await requestFileUpdate(token, labid, { flag: newFlag.trim(), file });

            if (!ok) {
                if (data.field === 'flag') setFlagError(data.message);
                else if (data.field === 'zipfile') setFileError(data.message);
                else setMessage({ type: 'error', text: data.message || 'No se pudo programar la actualización.' });
                return;
            }

            setFile(null);
            setMessage({
                type: 'success',
                text: data.applied
                    ? 'No había sesiones activas: el archivo y la flag ya están actualizados.'
                    : 'Actualización programada. Se aplicará cuando no haya sesiones activas.',
            });
            await refreshMeta();
        } catch {
            setMessage({ type: 'error', text: 'No se pudo conectar con el servidor.' });
        } finally {
            setIsBusy(false);
        }
    };

    const cancelPending = async () => {
        const confirmed = await confirm({
            title: '¿Cancelar la actualización?',
            message: 'Se descartará el archivo y la flag nuevos. El laboratorio seguirá igual y volverá a aceptar sesiones.',
            confirmText: 'Sí, cancelar',
            cancelText: 'Volver',
        });
        if (!confirmed) return;

        setIsBusy(true);
        setMessage(null);

        try {
            const { ok, data } = await cancelFileUpdate(token, labid);

            if (!ok) {
                setMessage({ type: 'error', text: data.message || 'No se pudo cancelar la actualización.' });
            } else {
                setMessage({ type: 'success', text: 'Actualización cancelada.' });
            }
            await refreshMeta();
        } catch {
            setMessage({ type: 'error', text: 'No se pudo conectar con el servidor.' });
        } finally {
            setIsBusy(false);
        }
    };

    // Admin only
    const applyNow = async () => {
        if (!isAdmin) return;

        const confirmed = await confirm({
            title: '¿Aplicar ahora?',
            message:
                `Se cerrarán las ${pending?.openSessions ?? 0} sesión(es) activa(s) de este laboratorio y se aplicará la actualización. ` +
                'Cada estudiante verá un aviso y conservará los trofeos que ya haya ganado, pero no recibe XP y pierde su progreso en el laboratorio.',
            confirmText: 'Sí, aplicar ahora',
            cancelText: 'Cancelar',
        });
        if (!confirmed) return;

        setIsBusy(true);
        setMessage(null);

        try {
            const { ok, data } = await applyFileUpdateNow(token, labid);

            setMessage(ok
                ? { type: 'success', text: 'Actualización aplicada.' }
                : { type: 'error', text: data.message || 'No se pudo aplicar la actualización.' });
            await refreshMeta();
        } catch {
            setMessage({ type: 'error', text: 'No se pudo conectar con el servidor.' });
        } finally {
            setIsBusy(false);
        }
    };

    return {
        pending,
        currentFlag,
        file,
        chooseFile,
        fileError,
        newFlag,
        changeFlag,
        fillGeneratedFlag,
        validateFlag,
        flagError,
        message,
        isBusy,
        isAdmin,
        submit,
        cancelPending,
        applyNow,
    };
}
