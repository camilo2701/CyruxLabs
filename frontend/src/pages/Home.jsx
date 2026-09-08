import { Link } from 'react-router-dom';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import '../styles/Home.css';

const features = [
  {
    title: 'Simulaciones guiadas',
    description:
      'Ejecuta experimentos paso a paso en un entorno controlado, sin riesgos ni consumo de materiales reales.',
  },
  {
    title: 'Seguimiento de progreso',
    description:
      'Cada práctica queda registrada, para que estudiantes e instructores puedan revisar el avance cuando lo necesiten.',
  },
  {
    title: 'Entornos aislados',
    description:
      'Cada práctica corre en su propio contenedor, así que puedes romper todo lo que quieras sin afectar nada más.',
  },
];

// Misma traducción número -> string que ya usa DashboardSidebar,
// para decidir qué accesos rápidos mostrar según el rol.
const ROLE_NAMES = {
  0: 'student',
  1: 'instructor',
  2: 'admin',
};

function Home() {
  const { user, isAuthenticated } = useAuth();
  const roleName = user ? ROLE_NAMES[user.role] : null;

  {/* accesos rapidos del req n°3: 
    lab siempre visible
    historial solo para estudiantes
    dashboard solo para instructor o admin
    perfil solo si hay sesión. */}
  const quickAccessItems = [
    {
      label: 'Laboratorios',
      description: 'Explora el catálogo de prácticas disponibles.',
      path: '/labs',
      show: true,
    },
    {
      label: 'Historial de Actividad',
      description: 'Revisa tus prácticas realizadas y su progreso.',
      path: '/dashboard#historial',
      show: isAuthenticated && roleName === 'student',
    },
    {
      label: 'Dashboard',
      description: 'Administra laboratorios, grupos y estudiantes.',
      path: '/dashboard',
      show: isAuthenticated && (roleName === 'instructor' || roleName === 'admin'),
    },
    {
      label: 'Perfil',
      description: 'Consulta y edita tu información de usuario.',
      // Nota: usaba '/profile', pero esa ruta no existe en App.jsx.
      // El perfil vive dentro de /dashboard (sección "Mi perfil" por defecto).
      path: '/dashboard',
      show: isAuthenticated,
    },
  ].filter((item) => item.show);

  return (
    <div className="home">
      <main className="home__main">
        <section className="home__welcome">
          {/* req n°2, mensaje de bienvenida al user */}
          <h1 className="home__title">
            {isAuthenticated ? `Bienvenido de vuelta, ${user.username}!` : 'Bienvenido a CyruxLabs'}
          </h1>
          <p className="home__subtitle">
            Aprende ciberseguridad haciendo, no memorizando: Laboratorios reales, sin riesgo real.
          </p>
        </section>

        {/* breve explicacion de cyrux y features de éste */}
        <section className="home__about" aria-labelledby="about-title">
          <h2 id="about-title" className="home__section-title">
            ¿Qué es CyruxLabs?
          </h2>
          <p className="home__about-text">
            CyruxLabs es una plataforma de simulación de laboratorios pensada para la formación práctica en pentesting.
            Permite a los estudiantes desarrollar actividades prácticar de forma segura y a
            los instructores diseñar, asignar y monitorear el trabajo de sus estudiantes.
          </p>

          <div className="home__feature-grid">
            {features.map((feature) => (
              <article key={feature.title} className="home__feature-card">
                <span className="home__feature-corner" aria-hidden="true" />
                <span className="home__feature-title">{feature.title}</span>
                <p className="home__feature-text">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* req n°3, botones de lab, historial, dashboard y perfil */}
        <section className="home__quick-access" aria-labelledby="quick-access-title">
          <h2 id="quick-access-title" className="home__section-title">
            Accesos rápidos
          </h2>

          <div className="home__quick-grid">
            {quickAccessItems.map((item) => (
              <Link key={item.path} to={item.path} className="home__quick-card">
                <span className="home__quick-label">{item.label}</span>
                <span className="home__quick-description">{item.description}</span>
                <span className="home__quick-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>

      {/* req n°4, pie de página con politica de privacidad y TyC */}
      <Footer />
    </div>
  );
}

export default Home;