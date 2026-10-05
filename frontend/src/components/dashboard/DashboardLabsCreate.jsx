import { useState } from "react";
import { Link } from 'react-router-dom';
import '../../styles/DashboardLabsCreate.css'

import DashboardLabsFileModal from './DashboardLabsFileModal';
import LabInfoFields from './labsCreate/LabInfoFields.jsx';
import BenefitsInput from './labsCreate/BenefitsInput.jsx';
import FlagField from './labsCreate/FlagField.jsx';
import LabFileDrop from './labsCreate/LabFileDrop.jsx';
import SuccessModal from '../SuccessModal.jsx';
import { useAuth } from '../../context/AuthContext';
import {
    MIN_BENEFITS,
    MAX_BENEFITS,
    getTitleError,
    getDescriptionError,
    getBenefitError,
    getFlagError,
} from '../../utils/labRules.js';

const BENEFITS_COUNT_ERROR = `Debes indicar al menos ${MIN_BENEFITS} beneficios que obtienes por desarrollar este laboratorio`;
const isZipFile = (file) => file.name.toLowerCase().endsWith('.zip');

function DashboardLabsCreate(){
    const [labTitle, setLabTitle] = useState('');
    const [labDesc, setLabDesc] = useState('');
    const [benefitInput, setBenefitInput] = useState('');
    const [benefitList, setBenefitList] = useState([]);
    const [flag, setFlag] = useState('');
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
    const [fileError, setFileError] = useState(false);
    const [fileErrorMessage, setFileErrorMessage] = useState('');

    const validateTitle = (value) => setTitleError(getTitleError(value));
    const validateDesc = (value) => setDescError(getDescriptionError(value));
    const validateFlag = (value) => setFlagError(getFlagError(value));

    const validateBenefitCount = () => {
        if (benefitList.length < MIN_BENEFITS) {
            setBenefitError(BENEFITS_COUNT_ERROR);
        } else {
            setBenefitError('');
        }
    };

    /*** BENEFITS ***/
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

    const handleRemoveBenefit = (indexToRemove) => {
        setBenefitList((prevList) => prevList.filter((_, i) => i !== indexToRemove));
    };

    /*** FILE MANAGEMENT ***/
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

        setFiles([pickedFiles[0]]);
        setFileError(false);
    };

    const handleRemoveFile = () => {
        setFiles([]);
        setFileError(true);
        setFileErrorMessage('Debes subir un archivo');
    };

    /*** HANDLE FORM SUBMISSION ***/
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Run every check so all the problems show up at once
        const titleProblem = getTitleError(labTitle);
        const descProblem = getDescriptionError(labDesc);
        const flagProblem = getFlagError(flag);
        setTitleError(titleProblem);
        setDescError(descProblem);
        setFlagError(flagProblem);

        const missingFile = files.length === 0;
        if (missingFile) {
            setFileError(true);
            setFileErrorMessage('Debes subir un archivo');
        }

        const missingBenefits = benefitList.length < MIN_BENEFITS;
        if (missingBenefits) {
            setBenefitError(BENEFITS_COUNT_ERROR);
        }

        if (titleProblem || descProblem || flagProblem || missingFile || missingBenefits) {
            return;
        }

        setFileError(false);
        setSubmitError('');

        const cleanTitle = labTitle.trim();

        const formData = new FormData();
        const url = 'http://localhost:4000/api/labs'
        formData.append('title', cleanTitle);
        formData.append('description', labDesc.trim());
        formData.append('benefits', JSON.stringify(benefitList));
        formData.append('flag', flag.trim());
        formData.append('zipfile', files[0]);

        try {
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

    const resetForm = () => {
        setLabTitle('');
        setLabDesc('');
        setBenefitInput('');
        setBenefitList([]);
        setFlag('');
        setFiles([]);
        setFileError(false);
        setFileErrorMessage('');
        setTitleError('');
        setDescError('');
        setBenefitError('');
        setFlagError('');
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
                    <p>No sabes cómo crear un laboratorio? Sigue esta <Link to="/docs">guía</Link></p>
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