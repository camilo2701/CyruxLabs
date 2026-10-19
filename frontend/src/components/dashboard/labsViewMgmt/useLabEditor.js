import { useCallback, useEffect, useState } from 'react';
import { useConfirm } from '../../ConfirmContext.jsx';
import {
    MIN_BENEFITS,
    MAX_BENEFITS,
    FRAGMENT_CRITERIA,
    getTitleError,
    getDescriptionError,
    getBenefitError,
    getInstructionsError,
    getTrophyErrorList,
    getTrophiesError,
} from '../../../utils/labRules.js';
import { getFragments } from '../../../utils/trophyCriteria.js';
import { getLabDetail, saveLab, removeLab } from './labsApi.js';

export const TABS = [
    { id: 'general', label: 'General' },
    { id: 'instructions', label: 'Instrucciones' },
    { id: 'trophies', label: 'Trofeos' },
    { id: 'file', label: 'Archivo y flag' },
];

const NO_ERRORS = { title: '', description: '', instructions: '', benefits: '', trophies: '' };

// Which tab shows each error (the backend names the field a problem belongs to)
const FIELD_TAB = {
    title: 'general',
    description: 'general',
    benefits: 'general',
    instructions: 'instructions',
    trophies: 'trophies',
};

// A trophy as the editor holds it. criteria is a list of fragments for command / process trophies
// and a string of digits for the others. key only identifies the card; trophyid is null until saved.
function toEditorTrophy(trophy) {
    return {
        key: `trophy-${trophy.trophyid}`,
        trophyid: trophy.trophyid,
        type: trophy.type,
        name: trophy.name,
        description: trophy.description,
        criteriatype: trophy.criteriatype,
        criteria: FRAGMENT_CRITERIA.includes(trophy.criteriatype)
            ? (getFragments(trophy.criteria) ?? [''])
            : String(trophy.criteria ?? ''),
        earnedCount: trophy.earnedCount ?? 0,
    };
}

// What the backend and the validation rules receive of a trophy
const toPayloadTrophy = (trophy) => ({
    type: trophy.type,
    name: trophy.name.trim(),
    description: trophy.description.trim(),
    criteriatype: trophy.criteriatype,
    criteria: trophy.criteria,
});

// Two lists with the same signature are the same trophies, so "has anything changed?" is a comparison of strings
const trophiesSignature = (list) =>
    JSON.stringify(list.map((trophy) => [
        trophy.trophyid, trophy.type, trophy.name.trim(), trophy.description.trim(), trophy.criteriatype, trophy.criteria,
    ]));

export function useLabEditor({ lab, token, onSaved, onDeleted }) {
    const confirm = useConfirm();
    const labid = lab.labid;

    const [detail, setDetail] = useState(null);
    const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'error'
    const [loadError, setLoadError] = useState('');
    const [activeTab, setActiveTab] = useState('general');

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [instructions, setInstructions] = useState('');
    const [existingBenefits, setExistingBenefits] = useState([]); // [{ benefitid, description }]
    const [removedBenefitIds, setRemovedBenefitIds] = useState([]);
    const [newBenefits, setNewBenefits] = useState([]); // strings pendientes de guardar
    const [benefitInput, setBenefitInput] = useState('');
    const [trophies, setTrophies] = useState([]);
    const [showTrophyErrors, setShowTrophyErrors] = useState(false);
    const [baseline, setBaseline] = useState(null); // what the lab looked like when it was loaded

    const [errors, setErrors] = useState(NO_ERRORS);
    const [message, setMessage] = useState(null); // { type: 'error' | 'success' | 'info', text }
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    /*** LOADING ***/

    // silent = keep showing the form while the data is read again (after saving)
    const loadDetail = useCallback(async ({ silent = false } = {}) => {
        if (!silent) {
            setLoadState('loading');
            setLoadError('');
        }

        try {
            const { ok, data } = await getLabDetail(token, labid);

            if (!ok) {
                if (!silent) {
                    setLoadError(data.message || 'No se pudo cargar el laboratorio.');
                    setLoadState('error');
                }
                return;
            }

            const loaded = data.lab;
            const loadedTrophies = loaded.trophies.map(toEditorTrophy);

            setDetail(loaded);
            setTitle(loaded.title);
            setDescription(loaded.description);
            setInstructions(loaded.instructions ?? '');
            setExistingBenefits(loaded.benefit ?? []);
            setRemovedBenefitIds([]);
            setNewBenefits([]);
            setBenefitInput('');
            setTrophies(loadedTrophies);
            setShowTrophyErrors(false);
            setErrors(NO_ERRORS);
            setBaseline({
                title: loaded.title,
                description: loaded.description,
                instructions: loaded.instructions ?? '',
                trophies: trophiesSignature(loadedTrophies),
            });
            setLoadState('ready');
        } catch {
            if (!silent) {
                setLoadError('No se pudo conectar con el servidor.');
                setLoadState('error');
            }
        }
    }, [token, labid]);

    useEffect(() => {
        loadDetail();
    }, [loadDetail]);

    // Reads the lab again but touches nothing the person is editing: only the data of the zip + flag
    // tab (current flag, pending update) is refreshed
    const refreshMeta = useCallback(async () => {
        try {
            const { ok, data } = await getLabDetail(token, labid);
            if (!ok) return;

            setDetail((previous) => (previous
                ? { ...previous, flag: data.lab.flag, pendingUpdate: data.lab.pendingUpdate }
                : previous));
        } catch {
            // The next refresh will try again
        }
    }, [token, labid]);

    /*** WHAT CHANGED ***/

    const titleChanged = !!baseline && title.trim() !== baseline.title;
    const descriptionChanged = !!baseline && description.trim() !== baseline.description;
    const instructionsChanged = !!baseline && instructions.trim() !== baseline.instructions.trim();
    const benefitsChanged = removedBenefitIds.length > 0 || newBenefits.length > 0;
    const trophiesChanged = !!baseline && trophiesSignature(trophies) !== baseline.trophies;

    // Per tab, to mark the tabs that have unsaved changes
    const dirty = {
        general: titleChanged || descriptionChanged || benefitsChanged,
        instructions: instructionsChanged,
        trophies: trophiesChanged,
    };
    const hasChanges = dirty.general || dirty.instructions || dirty.trophies;

    /*** VALIDATION (same rules as creating a lab: they come from labRules.js) ***/

    const validateTitle = (value = title) => setErrors((prev) => ({ ...prev, title: getTitleError(value) }));
    const validateDescription = (value = description) =>
        setErrors((prev) => ({ ...prev, description: getDescriptionError(value) }));
    const validateInstructions = (value = instructions) =>
        setErrors((prev) => ({ ...prev, instructions: getInstructionsError(value) }));

    // The lab has to keep the allowed amount of benefits. Only checked when they were touched, so a
    // lab created with other rules can still have its title edited.
    const getBenefitsCountError = () => {
        if (!benefitsChanged) return '';

        const count = existingBenefits.length + newBenefits.length;
        if (count < MIN_BENEFITS) return `Debes indicar al menos ${MIN_BENEFITS} beneficios`;
        if (count > MAX_BENEFITS) return `Máximo ${MAX_BENEFITS} beneficios`;
        return '';
    };

    const validateBenefitCount = () => setErrors((prev) => ({ ...prev, benefits: getBenefitsCountError() }));

    /*** BENEFITS ***/

    // Returns true if the benefit was accepted, so the input knows to clear its text box
    const addBenefit = (text) => {
        if (existingBenefits.length + newBenefits.length >= MAX_BENEFITS) {
            setErrors((prev) => ({ ...prev, benefits: `Máximo ${MAX_BENEFITS} beneficios` }));
            return false;
        }

        const problem = getBenefitError(text);
        if (problem) {
            setErrors((prev) => ({ ...prev, benefits: problem }));
            return false;
        }

        setNewBenefits((prev) => [...prev, text]);
        setErrors((prev) => ({ ...prev, benefits: '' }));
        return true;
    };

    const removeExistingBenefit = (benefitid) => {
        setExistingBenefits((prev) => prev.filter((benefit) => benefit.benefitid !== benefitid));
        setRemovedBenefitIds((prev) => [...prev, benefitid]);
    };

    const removeNewBenefit = (indexToRemove) => {
        setNewBenefits((prev) => prev.filter((_, index) => index !== indexToRemove));
    };

    /*** SAVE ***/

    // The trophy part of the request: what to add, what to edit and what to remove
    const buildTrophyChanges = () => {
        const originals = new Map(detail.trophies.map((trophy) => [trophy.trophyid, trophiesSignature([toEditorTrophy(trophy)])]));
        const keptIds = new Set(trophies.filter((trophy) => trophy.trophyid).map((trophy) => trophy.trophyid));

        return {
            add: trophies.filter((trophy) => !trophy.trophyid).map(toPayloadTrophy),
            update: trophies
                .filter((trophy) => trophy.trophyid && trophiesSignature([trophy]) !== originals.get(trophy.trophyid))
                .map((trophy) => ({ trophyid: trophy.trophyid, ...toPayloadTrophy(trophy) })),
            removeIds: detail.trophies
                .filter((trophy) => !keptIds.has(trophy.trophyid))
                .map((trophy) => trophy.trophyid),
        };
    };

    const save = async () => {
        if (!baseline || isSaving || isDeleting) return;

        // Only what changed is checked and sent
        const changes = {};
        const nextErrors = { ...NO_ERRORS };

        if (titleChanged) {
            nextErrors.title = getTitleError(title);
            changes.title = title.trim();
        }
        if (descriptionChanged) {
            nextErrors.description = getDescriptionError(description);
            changes.description = description.trim();
        }
        if (instructionsChanged) {
            nextErrors.instructions = getInstructionsError(instructions);
            changes.instructions = instructions.trim();
        }
        if (benefitsChanged) {
            nextErrors.benefits = getBenefitsCountError();
            changes.addBenefits = newBenefits;
            changes.removeBenefitIds = removedBenefitIds;
        }
        if (trophiesChanged) {
            setShowTrophyErrors(true);
            nextErrors.trophies = getTrophiesError(trophies.map(toPayloadTrophy));
            changes.trophyChanges = buildTrophyChanges();
        }

        if (Object.keys(changes).length === 0) {
            setMessage({ type: 'info', text: 'No hay cambios para guardar.' });
            return;
        }

        setErrors(nextErrors);

        const firstProblem = Object.keys(nextErrors).find((field) => nextErrors[field]);
        if (firstProblem) {
            setActiveTab(FIELD_TAB[firstProblem]);
            setMessage({ type: 'error', text: 'Revisa los campos marcados en rojo.' });
            return;
        }

        setIsSaving(true);
        setMessage(null);

        try {
            const { ok, data } = await saveLab(token, labid, changes);

            if (!ok) {
                // The backend says which field a problem belongs to
                if (FIELD_TAB[data.field]) {
                    setErrors((prev) => ({ ...prev, [data.field]: data.message }));
                    setActiveTab(FIELD_TAB[data.field]);
                    setMessage({ type: 'error', text: 'Revisa los campos marcados en rojo.' });
                } else {
                    setMessage({ type: 'error', text: data.message || 'No se pudieron guardar los cambios.' });
                }
                return;
            }

            // Read the lab again: new benefits and trophies have their real ids now
            await loadDetail({ silent: true });
            setMessage({ type: 'success', text: 'Laboratorio actualizado correctamente.' });
            onSaved();
        } catch {
            setMessage({ type: 'error', text: 'No se pudo conectar con el servidor.' });
        } finally {
            setIsSaving(false);
        }
    };

    /*** DELETE ***/

    const deleteLab = async () => {
        const confirmed = await confirm({
            title: '¿Eliminar el laboratorio?',
            message: `Vas a eliminar «${detail?.title ?? lab.title}». Esta acción no se puede deshacer.`,
            confirmText: 'Sí, eliminar',
            cancelText: 'Cancelar',
        });
        if (!confirmed) return;

        setIsDeleting(true);
        setMessage(null);

        try {
            const { ok, data } = await removeLab(token, labid);

            if (!ok) {
                setMessage({ type: 'error', text: data.message || 'No se pudo eliminar el laboratorio.' });
                return;
            }

            onDeleted();
        } catch {
            setMessage({ type: 'error', text: 'No se pudo conectar con el servidor.' });
        } finally {
            setIsDeleting(false);
        }
    };

    // List of { type, name, description, criteria } errors, one per trophy card
    const trophyErrorList = getTrophyErrorList(trophies.map(toPayloadTrophy));

    return {
        detail,
        loadState,
        loadError,
        reload: loadDetail,
        refreshMeta,

        activeTab,
        setActiveTab,
        dirty,
        hasChanges,
        errors,
        message,
        setMessage,
        isSaving,
        isDeleting,
        save,
        deleteLab,

        title,
        setTitle,
        validateTitle,
        description,
        setDescription,
        validateDescription,
        instructions,
        setInstructions,
        validateInstructions,

        existingBenefits,
        newBenefits,
        benefitInput,
        setBenefitInput,
        addBenefit,
        removeExistingBenefit,
        removeNewBenefit,
        validateBenefitCount,

        trophies,
        setTrophies,
        trophyErrorList,
        showTrophyErrors,
    };
}
