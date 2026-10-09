import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';
import styles from '../styles/PrivacyPolicy.module.css';

const LAST_UPDATED = '7 de octubre de 2026';

const SECTIONS = [
  { id: 'introduccion', title: 'Introducción' },
  { id: 'informacion-recopilada', title: 'Información que recopilamos' },
  { id: 'uso-informacion', title: 'Cómo usamos la información' },
  { id: 'informacion-visible', title: 'Información visible para otros usuarios' },
  { id: 'almacenamiento', title: 'Almacenamiento' },
  { id: 'compartir', title: 'Compartir información' },
  { id: 'seguridad', title: 'Seguridad' },
  { id: 'control', title: 'Control sobre tus datos' },
  { id: 'cambios', title: 'Cambios en esta política' },
  { id: 'contacto', title: 'Contacto' },
];

function LegalPolicy() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleIndexClick = (event, id) => {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <main className={styles.page}>
        <div className={styles.container}>
          <header className={styles.header}>
            <span className={styles.eyebrow}>LEGAL</span>
            <h1>Política de Privacidad</h1>
            <p>
              Aquí te explicamos qué información se recopila al usar CyruxLabs, para qué se usa y qué
              puedes hacer con ella.
            </p>
            <span className={styles.updated}>Última actualización: {LAST_UPDATED}</span>
          </header>

          {/* div con role="navigation" en vez de <nav>: Header.module.css tiene un
              selector global "nav { ... }" que si no se aplicaría también aquí */}
          <div className={styles.index} role="navigation" aria-label="Contenido de la política">
            <span className={styles.indexTitle}>Contenido</span>
            <ol style={{ '--index-rows': Math.ceil(SECTIONS.length / 2) }}>
              {SECTIONS.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} onClick={(event) => handleIndexClick(event, section.id)}>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>

          <article className={styles.card}>
            <section id="introduccion" className={styles.section}>
              <h2>1. Introducción</h2>
              <p>
                CyruxLabs es una plataforma desarrollada con fines educativos, orientada a la práctica de
                ciberseguridad mediante laboratorios. Al registrarte en la plataforma, aceptas el
                tratamiento de tu información según lo descrito en esta política.
              </p>
            </section>

            <section id="informacion-recopilada" className={styles.section}>
              <h2>2. Información que recopilamos</h2>
              <p>Para que la plataforma funcione, se guarda la siguiente información:</p>
              <ul>
                <li>
                  <strong>Datos de tu cuenta:</strong> nombre de usuario, nombre, apellido, correo
                  electrónico, contraseña, avatar, rol y fecha de creación de la cuenta.
                </li>
                <li>
                  <strong>Actividad en la plataforma:</strong> sesiones de laboratorio iniciadas y
                  finalizadas, flags enviadas, puntaje, nivel, insignias y trofeos obtenidos.
                </li>
                <li>
                  <strong>Reportes:</strong> la información que escribas al reportar un problema en un
                  laboratorio.
                </li>
                <li>
                  <strong>Datos de seguridad:</strong> la cantidad de intentos fallidos al iniciar sesión,
                  para bloquear temporalmente el acceso cuando corresponda.
                </li>
              </ul>
            </section>

            <section id="uso-informacion" className={styles.section}>
              <h2>3. Cómo usamos la información</h2>
              <p>La información se utiliza únicamente para:</p>
              <ul>
                <li>Crear y administrar tu cuenta, y permitirte iniciar sesión.</li>
                <li>Registrar tu progreso, puntaje, nivel e insignias.</li>
                <li>Mostrar tu perfil y tu historial de actividad.</li>
                <li>Permitir que instructores y administradores gestionen la plataforma.</li>
                <li>Revisar y corregir problemas reportados en los laboratorios.</li>
                <li>Proteger las cuentas frente a accesos no autorizados.</li>
              </ul>
            </section>

            <section id="informacion-visible" className={styles.section}>
              <h2>4. Información visible para otros usuarios</h2>
              <p>
                Cualquier usuario con sesión iniciada puede ver tu <strong>perfil público</strong>, que
                muestra tu nombre de usuario, avatar, rol, nivel, puntaje, insignias, trofeos y fecha de registro.
                Tu correo electrónico y tu contraseña no forman parte del perfil público. Los instructores y administradores pueden acceder a información adicional, como tu nombre,
                apellido, correo e historial de actividad, para gestionar la plataforma.
              </p>
            </section>

            <section id="almacenamiento" className={styles.section}>
              <h2>5. Almacenamiento</h2>
              <p>
                La información se guarda en una base de datos alojada en servicios de terceros utilizados
                para el funcionamiento de la plataforma.
              </p>
            </section>

            <section id="compartir" className={styles.section}>
              <h2>6. Compartir información</h2>
              <p>
                Tu información no se vende ni se cede a terceros con fines comerciales. Solo se utiliza
                dentro de CyruxLabs para los fines descritos en esta política.
              </p>
            </section>

            <section id="seguridad" className={styles.section}>
              <h2>7. Seguridad</h2>
              <p>
                Se aplican medidas razonables para proteger tu información. Sin embargo, ningún sistema es
                completamente seguro, y debido a esto recomendamos usar una contraseña única y no compartirla con nadie.
              </p>
            </section>

            <section id="control" className={styles.section}>
              <h2>8. Control sobre tus datos</h2>
              <ul>
                <li>
                  Puedes revisar y modificar tus datos personales, avatar y contraseña desde{' '}
                  <Link to="/dashboard" className={styles.link}>
                    Dashboard → Mi perfil
                  </Link>
                  .
                </li>
                <li>
                  Puedes eliminar tu cuenta desde la misma sección. Al hacerlo, se elimina tu cuenta junto
                  con la información asociada a ella.
                </li>
              </ul>
            </section>

            <section id="cambios" className={styles.section}>
              <h2>9. Cambios en esta política</h2>
              <p>
                Esta política puede actualizarse en cualquier momento, y la fecha se modificará en
                base a la última actualización que aparece al inicio de esta página.
              </p>
            </section>

            <section id="contacto" className={styles.section}>
              <h2>10. Contacto</h2>
              <p>
                Si tienes dudas sobre esta política o sobre el uso de tu información, puedes comunicarte
                con un administrador de la plataforma.
              </p>
            </section>
          </article>
        </div>
      </main>

      <Footer />
    </>
  );
}

export default LegalPolicy;
