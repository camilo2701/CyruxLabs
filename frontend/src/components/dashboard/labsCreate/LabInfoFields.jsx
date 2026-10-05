function LabInfoFields({
    title,
    onTitleChange,
    onTitleBlur,
    titleError,
    description,
    onDescriptionChange,
    onDescriptionBlur,
    descError,
}) {
    return (
        <>
            <div className="nebula-input">
                <input
                    required
                    type="text"
                    name="title"
                    autoComplete="off"
                    className="input"
                    maxLength={50}
                    value={title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    onBlur={(e) => onTitleBlur(e.target.value)}
                />
                <label className="user-label">Título del laboratorio</label>
                <p className="nebula-error">{titleError}</p>
            </div>

            <div className="nebula-input--desc">
                <textarea
                    required
                    name="description"
                    autoComplete="off"
                    className="input"
                    maxLength={500}
                    value={description}
                    onChange={(e) => onDescriptionChange(e.target.value)}
                    onBlur={(e) => onDescriptionBlur(e.target.value)}
                />
                <label className="user-label">Descripción del laboratorio</label>
                <p className="nebula-error">{descError}</p>
            </div>
        </>
    );
}

export default LabInfoFields;