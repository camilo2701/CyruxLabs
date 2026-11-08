// Este archivo se encarga del formulario de creación de laboratorios: valida cada
// campo, gestiona el archivo .zip y envía todo al backend mediante FormData.
import { useState } from "react";
import { Link } from 'react-router-dom';
import '../../styles/DashboardLabsCreate.css'

import DashboardLabsFileModal from './DashboardLabsFileModal';
import LabInfoFields from './labsCreate/LabInfoFields.jsx';
import BenefitsInput from './labsCreate/BenefitsInput.jsx';
import FlagField from './labsCreate/FlagField.jsx';
import ScoreField from './labsCreate/ScoreField.jsx';
import LabFileDrop from './labsCreate/LabFileDrop.jsx';
import InstructionsEditor from './labsCreate/InstructionsEditor.jsx';
import TrophiesEditor from './labsCreate/TrophiesEditor.jsx';
import SuccessModal from '../SuccessModal.jsx';
import { useAuth } from '../../context/AuthContext';
import {
    MIN_BENEFITS,
    MAX_BENEFITS,
    getTitleError,
    getDescriptionError,
    getBenefitError,
    getFlagError,
    getScoreError,
    getInstructionsError,
    getTrophiesError,
} from '../../utils/labRules.js';

// Esta constante se encarga de guardar el mensaje de error por falta de beneficios mínimos.
const BENEFITS_COUNT_ERROR = `Debes indicar al menos ${MIN_BENEFITS} beneficios que obtienes por desarrollar este laboratorio`;
// Esta constante se encarga de definir el tamaño máximo permitido del .zip (50 MB en bytes).
const MAX_ZIP_BYTES = 50 * 1024 * 1024;
// Esta función se encarga de comprobar que un archivo tenga extensión .zip.
const isZipFile = (file) => file.name.toLowerCase().endsWith('.zip');

// Este componente se encarga de renderizar y manejar todo el formulario de creación
// de un laboratorio, con su estado, validaciones y envío.
function DashboardLabsCreate(){
    const [labTitle, setLabTitle] = useState('');
    const [labDesc, setLabDesc] = useState('');
    const [benefitInput, setBenefitInput] = useState('');
    const [benefitList, setBenefitList] = useState([]);
    const [flag, setFlag] = useState('');
    // null = nothing picked yet (the field is required, so the instructor has to choose one)
    const [score, setScore] = useState(null);
    const [instructions, setInstructions] = useState('');
    const [trophies, setTrophies] = useState([]);
    const [showTrophyErrors, setShowTrophyErrors] = useState(false);
    const [files, setFiles] = useState([]);
    const [showFilesModal, setShowFilesModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [submitError, setSubmitError] = useState('');
    const { token } = useAuth();

    /*** ERROR MANAGEMENT ***/
    const [titleError, setTitleError] = useState('');
    const [descError, setDescError] = useState('');
    const [benefitError, setBenefitError] = useState('');
    const [flagError, setFlagError] = useState('');
    const [scoreError, setScoreError] = useState('');
    const [instructionsError, setInstructionsError] = useState('');
    const [fileError, setFileError] = useState(false);
    const [fileErrorMessage, setFileErrorMessage] = useState('');

    const trophiesError = getTrophiesError(trophies);

    // Estas funciones se encargan de validar cada campo al perder el foco y
    // guardar su mensaje de error correspondiente.
    const validateTitle = (value) => setTitleError(getTitleError(value));
    const validateDesc = (value) => setDescError(getDescriptionError(value));
    const validateFlag = (value) => setFlagError(getFlagError(value));
    const validateInstructions = (value) => setInstructionsError(getInstructionsError(value));

    // Esta función se encarga de validar que se haya ingresado la cantidad mínima de beneficios.
    const validateBenefitCount = () => {
        if (benefitList.length < MIN_BENEFITS) {
            setBenefitError(BENEFITS_COUNT_ERROR);
        } else {
            setBenefitError('');
        }
    };

    /*** SCORE ***/
    // Esta función se encarga de actualizar el puntaje elegido y revalidarlo.
    // Picking a tier is the only way to change it, so the error clears as soon as one is chosen
    const handleScoreChange = (value) => {
        setScore(value);
        setScoreError(getScoreError(value));
    };

    /*** BENEFITS ***/
    // Esta función se encarga de agregar un beneficio a la lista si pasa las
    // validaciones (no exceder el máximo y no estar mal escrito).
    // Returns true if the benefit was accepted, so BenefitsInput knows to clear its text box
    const handleAddBenefit = (text) => {
        if (benefitList.length >= MAX_BENEFITS) {
            setBenefitError(`Máximo ${MAX_BENEFITS} beneficios`);
            return false;
        }

        const error = getBenefitError(text);
        if (error) {
            setBenefitError(error);
            return false;
        }

        setBenefitList((prevList) => [...prevList, text]);
        setBenefitError('');
        return true;
    };

    // Esta función se encarga de quitar de la lista el beneficio en la posición indicada.
    const handleRemoveBenefit = (indexToRemove) => {
        setBenefitList((prevList) => prevList.filter((_, i) => i !== indexToRemove));
    };

    /*** FILE MANAGEMENT ***/
    // Esta función se encarga de validar el archivo subido (que sea uno solo, .zip
    // y dentro del límite de tamaño) antes de aceptarlo.
    // Receives the files from both the drop and the file picker
    const handleFilesPicked = (pickedFiles) => {
        if (pickedFiles.length !== 1) {
            setFileError(true);
            setFileErrorMessage('Debes subir un archivo');
            return;
        }
        else if (!isZipFile(pickedFiles[0])) {
            setFileError(true);
            setFileErrorMessage('Formato inválido, debes subir un archivo comprimido .zip');
            return;
        }
        else if (pickedFiles[0].size > MAX_ZIP_BYTES) {
            setFileError(true);
            setFileErrorMessage('El archivo supera el límite de 50 MB');
            return;
        }

        setFiles([pickedFiles[0]]);
        setFileError(false);
    };

    // Esta función se encarga de quitar el archivo cargado y volver a marcar el campo como requerido.
    const handleRemoveFile = () => {
        setFiles([]);
        setFileError(true);
        setFileErrorMessage('Debes subir un archivo');
    };

    /*** HANDLE FORM SUBMISSION ***/
    // Esta función se encarga de validar todo el formulario, verificar el título
    // duplicado y enviar el laboratorio al backend.
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Run every check so all the problems show up at once
        const titleProblem = getTitleError(labTitle);
        const descProblem = getDescriptionError(labDesc);
        const flagProblem = getFlagError(flag);
        const scoreProblem = getScoreError(score);
        const instructionsProblem = getInstructionsError(instructions);
        setTitleError(titleProblem);
        setDescError(descProblem);
        setFlagError(flagProblem);
        setScoreError(scoreProblem);
        setInstructionsError(instructionsProblem);
        setShowTrophyErrors(true);

        const missingFile = files.length === 0;
        if (missingFile) {
            setFileError(true);
            setFileErrorMessage('Debes subir un archivo');
        }

        const missingBenefits = benefitList.length < MIN_BENEFITS;
        if (missingBenefits) {
            setBenefitError(BENEFITS_COUNT_ERROR);
        }

        // Si hay cualquier problema de validación, se corta el envío
        if (
            titleProblem || descProblem || flagProblem || scoreProblem || instructionsProblem ||
            trophiesError || missingFile || missingBenefits
        ) {
            return;
        }

        setFileError(false);
        setSubmitError('');

        const cleanTitle = labTitle.trim();

        // Arma el cuerpo de la petición con todos los campos del laboratorio
        const formData = new FormData();
        const url = 'http://localhost:4000/api/labs'
        formData.append('title', cleanTitle);
        formData.append('description', labDesc.trim());
        formData.append('benefits', JSON.stringify(benefitList));
        formData.append('flag', flag.trim());
        formData.append('score', String(score));
        formData.append('instructions', instructions.trim());
        // The card id is only for the editor, so it is left out of what we send
        formData.append('trophies', JSON.stringify(trophies.map(({ id, ...trophy }) => trophy)));
        formData.append('zipfile', files[0]);

        try {
            // Antes de crear, consulta al backend si ya existe un lab con ese título
            const duplicateCheck = await fetch(
                `${url}/check-title?title=${encodeURIComponent(cleanTitle)}`
            );
            const duplicateResult = await duplicateCheck.json();

            if (duplicateResult.exists) {
                setTitleError('Ya existe un laboratorio con este título');
                return;
            }

            setSuccessMessage(''); // clear any old message before trying again

            // No Content-Type here: the browser sets it (with the boundary) for FormData
            const response = await fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                console.error('Server error:', result);

                // Según el campo que devuelva el backend, se muestra el error en ese campo
                // The backend says which field a conflict belongs to
                if (result.field === 'flag') {
                    setFlagError(result.message);
                    return;
                }
                if (result.field === 'title') {
                    setTitleError(result.message);
                    return;
                }

                setSubmitError(
                    response.status < 500
                        ? (result.message || result.error || 'No se pudo crear el laboratorio.')
                        : 'No se pudo crear el laboratorio. Intenta de nuevo.'
                );
                return;
            }

            console.log('Lab created:', result);
            setSuccessMessage('Laboratorio creado exitosamente');
        } catch (err) {
            console.error('Network error:', err);
            setSubmitError('No se pudo conectar con el servidor.');
        }
    };

    // Esta función se encarga de limpiar todos los campos y errores del formulario,
    // dejándolo listo para crear otro laboratorio.
    const resetForm = () => {
        setLabTitle('');
        setLabDesc('');
        setBenefitInput('');
        setBenefitList([]);
        setFlag('');
        setScore(null);
        setInstructions('');
        setTrophies([]);
        setShowTrophyErrors(false);
        setFiles([]);
        setFileError(false);
        setFileErrorMessage('');
        setTitleError('');
        setDescError('');
        setBenefitError('');
        setFlagError('');
        setScoreError('');
        setInstructionsError('');
        setSubmitError('');
    };

    /*** PAGE ***/

    return(
        <div className="container">
            <span className="dashboard-section-header">
                <p>Crea tu propio laboratorio de pentesting y compártelo con la comunidad!</p>
            </span>
            <form className="container-create-lab" onSubmit={handleSubmit}>
                <div className="container-wrapper">
                    <div className="container-create-lab-info">
                        <LabInfoFields
                            title={labTitle}
                            onTitleChange={setLabTitle}
                            onTitleBlur={validateTitle}
                            titleError={titleError}
                            description={labDesc}
                            onDescriptionChange={setLabDesc}
                            onDescriptionBlur={validateDesc}
                            descError={descError}
                        />
                        <BenefitsInput
                            value={benefitInput}
                            onValueChange={setBenefitInput}
                            benefits={benefitList}
                            onAdd={handleAddBenefit}
                            onRemove={handleRemoveBenefit}
                            error={benefitError}
                            onBlur={validateBenefitCount}
                        />
                        <FlagField
                            value={flag}
                            onChange={setFlag}
                            onBlur={validateFlag}
                            error={flagError}
                        />
                    </div>

                    <LabFileDrop
                        files={files}
                        onFilesPicked={handleFilesPicked}
                        onViewFiles={() => setShowFilesModal(true)}
                    />
                </div>

                <ScoreField
                    value={score}
                    onChange={handleScoreChange}
                    error={scoreError}
                />

                <InstructionsEditor
                    value={instructions}
                    onChange={setInstructions}
                    onBlur={validateInstructions}
                    error={instructionsError}
                />

                <TrophiesEditor
                    trophies={trophies}
                    onChange={setTrophies}
                    showAllErrors={showTrophyErrors}
                    error={showTrophyErrors ? trophiesError : ''}
                />

                {fileError && (
                    <p className="file-error-msg">{fileErrorMessage}</p>
                )}
                {submitError && (
                    <p className="file-error-msg">{submitError}</p>
                )}
                <div className="container-create-lab-submit">
                    <button>
                        Crear Laboratorio
                    </button>
                    <p>
                        No sabes cómo crear un laboratorio? Sigue esta{' '}
                        <Link to="/docs" target="_blank" rel="noopener noreferrer">guía</Link>
                    </p>
                </div>
            </form>
            {showFilesModal && (
                <DashboardLabsFileModal
                    files={files}
                    onRemove={handleRemoveFile}
                    onClose={() => setShowFilesModal(false)}
                />
            )}
            {successMessage && (
                <SuccessModal message={successMessage} onClose={() => {setSuccessMessage(''); resetForm();}} />
            )}
        </div>
    )
}

export default DashboardLabsCreate
