import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';
import styles from '../styles/PrivacyPolicy.module.css';

const LAST_UPDATED = '7 de octubre de 2026';

const SECTIONS = [
  { id: 'aceptacion', title: 'Aceptación de los términos' },
  { id: 'cuentas', title: 'Cuentas de usuario' },
  { id: 'uso-permitido', title: 'Uso permitido de la plataforma' },
  { id: 'uso-etico', title: 'Uso ético de lo aprendido' },
  { id: 'laboratorios', title: 'Laboratorios' },
  { id: 'incumplimiento', title: 'Incumplimiento de los términos' },
  { id: 'responsabilidad', title: 'Limitación de responsabilidad' },
  { id: 'privacidad', title: 'Privacidad' },
  { id: 'cambios', title: 'Cambios en los términos' },
  { id: 'contacto', title: 'Contacto' },
];

function TermsPage() {
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
            <h1>Términos y Condiciones</h1>
            <p>
              Estas son las reglas para usar CyruxLabs. Te pedimos leerlas antes de registrarte y usar la
              plataforma.
            </p>
            <span className={styles.updated}>Última actualización: {LAST_UPDATED}</span>
          </header>

          <div className={styles.index} role="navigation" aria-label="Contenido de los términos">
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
            <section id="aceptacion" className={styles.section}>
              <h2>1. Aceptación de los términos</h2>
              <p>
                Al registrarte o usar CyruxLabs, aceptas los siguientes Términos y Condiciones. Si <strong>no</strong> estás de
                acuerdo con ellos, <strong>no</strong> utilices la plataforma.
              </p>
            </section>

            <section id="cuentas" className={styles.section}>
              <h2>2. Cuentas de usuario</h2>
              <ul>
                <li>Debes entregar información verdadera al registrarte.</li>
                <li>Tu cuenta es personal e intransferible: no debes compartirla ni usar la de otra persona.</li>
                <li>
                  Eres responsable de mantener tu contraseña en secreto y de la actividad que se realice
                  con tu cuenta.
                </li>
              </ul>
            </section>

            <section id="uso-permitido" className={styles.section}>
              <h2>3. Uso permitido de la plataforma</h2>
              <p>Al usar CyruxLabs, te comprometes a:</p>
              <ul>
                <li>
                  Realizar ataques <strong>solo contra los entornos de laboratorio</strong> asignados en
                  tus sesiones. Está prohibido atacar la infraestructura de la plataforma, sus servidores
                  o a otros usuarios.
                </li>
                <li>
                  <strong>No compartir flags ni soluciones</strong> de los laboratorios, ya sea dentro o
                  fuera de la plataforma.
                </li>
                <li>
                  <strong>No manipular el puntaje</strong>, los niveles, las insignias o los trofeos, ni
                  aprovechar fallas de la plataforma para obtenerlos.
                </li>
                <li>
                  Enviar <strong>reportes de buena fe</strong>: los reportes de problemas deben describir
                  fallas reales, sin spam ni contenido ofensivo.
                </li>
              </ul>
              <p>
                Si encuentras una falla de seguridad en la plataforma, repórtala a un administrador en vez
                de aprovecharla.
              </p>
            </section>

            <section id="uso-etico" className={styles.section}>
              <h2>4. Uso ético de lo aprendido</h2>
              <p>
                Los conocimientos y técnicas que practiques en CyruxLabs tienen fines exclusivamente
                educativos. No debes usarlos contra sistemas, redes o personas sin autorización.
                Cada usuario es el único responsable del uso que haga de lo aprendido. CyruxLabs no se
                hace responsable del mal uso de los conocimientos adquiridos en la plataforma.
              </p>
            </section>

            <section id="laboratorios" className={styles.section}>
              <h2>5. Laboratorios</h2>
              <p>
                Los laboratorios son creados por instructores con fines educativos. Pueden modificarse,
                dejar de estar disponibles o eliminarse en cualquier momento sin ningún aviso previo.
              </p>
            </section>

            <section id="incumplimiento" className={styles.section}>
              <h2>6. Incumplimiento de los términos</h2>
              <p>
                Si un usuario incumple estos términos, los administradores pueden restringir su acceso o
                eliminar su cuenta sin ningún aviso previo.
              </p>
            </section>

            <section id="responsabilidad" className={styles.section}>
              <h2>7. Limitación de responsabilidad</h2>
              <p>
                CyruxLabs no se hace responsable por interrupciones del servicio, errores, pérdida de
                información o de la imposibilidad de usar la plataforma.
              </p>
            </section>

            <section id="privacidad" className={styles.section}>
              <h2>8. Privacidad</h2>
              <p>
                El tratamiento de tu información se describe en la{' '}
                <Link to="/privacy-policy" className={styles.link}>
                  Política de Privacidad
                </Link>
                .
              </p>
            </section>

            <section id="cambios" className={styles.section}>
              <h2>9. Cambios en los términos</h2>
              <p>
                Estos términos pueden actualizarse en cualquier momento, y la fecha se modificará en
                base a la última actualización que aparece al inicio de esta página. Seguir usando la
                plataforma después de un cambio significa que aceptas los nuevos términos.
              </p>
            </section>

            <section id="contacto" className={styles.section}>
              <h2>10. Contacto</h2>
              <p>
                Si tienes dudas sobre estos términos, puedes comunicarte con un administrador de la
                plataforma.
              </p>
            </section>
          </article>
        </div>
      </main>

      <Footer />
    </>
  );
}

export default TermsPage;
