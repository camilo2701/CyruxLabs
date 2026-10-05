import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { avatarMap } from '../components/dashboard/AvatarSelector';
import { getBadgeIcon } from '../data/badgeIcons';
import Footer from '../components/Footer';
import styles from '../styles/ProfilePage.module.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const ROLE_LABELS = {
  0: 'Estudiante',
  1: 'Instructor',
  2: 'Administrador',
};

function formatDate(dateString) {
  if (!dateString) return '—';
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const formatPoints = (value) => Number(value || 0).toLocaleString('es-CL');

function ProfilePage() {
  const { username: usernameParam } = useParams();
  const { user, token, isLoading } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const username = usernameParam || user?.username;
  const isOwnProfile = !!user && profile?.userid === user.userid;

  useEffect(() => {
    if (!token || !username) return;

    const controller = new AbortController();
    setLoading(true);
    setError('');
    setProfile(null);

    fetch(`${API_URL}/users/profile/${encodeURIComponent(username)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          setError(data.error || 'No se pudo cargar el perfil');
          return;
        }
        setProfile(data.profile);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError('No se pudo conectar con el servidor.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [username, token]);

  useEffect(() => {
    const query = searchText.trim();
    if (!query || !token) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    setSearching(true);

    const timeoutId = setTimeout(() => {
      fetch(`${API_URL}/users/search?search=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
        .then((response) => response.json())
        .then((data) => setSearchResults(data.users || []))
        .catch(() => {})
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [searchText, token]);

  if (isLoading) {
    return <p className={styles.status}>Cargando...</p>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const renderProfile = () => {
    if (loading) return <p className={styles.status}>Cargando perfil...</p>;

    if (error) {
      return (
        <div className={styles.card}>
          <div className={styles.empty}>
            <h2>{error}</h2>
            <Link to="/perfil" className={`${styles.button} ${styles.buttonSecondary}`}>
              Volver a mi perfil
            </Link>
          </div>
        </div>
      );
    }

    if (!profile) return null;

    const isMaxLevel = profile.level === profile.maxLevel;

    return (
      <>
        {/* info principal */}
        <div className={`${styles.card} ${styles.hero}`}>
          <div className={styles.avatarWrapper}>
            <img
              src={avatarMap[profile.avatar] || avatarMap['avatar-01.svg']}
              alt={`Avatar de ${profile.username}`}
              className={styles.avatar}
            />
            <span className={styles.levelBubble} title={`Nivel ${profile.level}`}>
              {profile.level}
            </span>
          </div>

          <div className={styles.heroInfo}>
            <div className={styles.heroTitle}>
              <h1>{profile.username}</h1>
              <span className={styles.roleChip}>{ROLE_LABELS[profile.role] || 'Estudiante'}</span>
            </div>

            <div className={styles.heroMeta}>
              <span>
                <strong>Nivel {profile.level}</strong>
              </span>
              <span>{formatPoints(profile.score)} pts</span>
              <span>
                {profile.badges.length} insignia{profile.badges.length === 1 ? '' : 's'}
              </span>
              <span>Miembro desde {formatDate(profile.dateofcreation)}</span>
            </div>
          </div>

          {isOwnProfile && (
            <Link to="/dashboard" className={`${styles.button} ${styles.buttonPrimary}`}>
              ⚙ Configurar perfil
            </Link>
          )}
        </div>

        {/* lvl y progreso */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Progreso</h2>
            <span className={styles.levelLabel}>
              Nivel {profile.level} / {profile.maxLevel}
            </span>
          </div>

          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={profile.progress}
          >
            <div className={styles.progressFill} style={{ width: `${profile.progress}%` }} />
          </div>

          <div className={styles.progressMeta}>
            <span>{formatPoints(profile.score)} pts</span>
            <span>
              {isMaxLevel
                ? 'Nivel máximo alcanzado'
                : `Faltan ${formatPoints(profile.pointsToNextLevel)} pts para el nivel ${profile.level + 1}`}
            </span>
          </div>

          <div className={styles.levelSteps}>
            {Array.from({ length: profile.maxLevel }, (_, i) => i + 1).map((step) => (
              <span
                key={step}
                className={`${styles.levelStep} ${step <= profile.level ? styles.levelStepDone : ''}`}
              >
                {step}
              </span>
            ))}
          </div>
        </div>

        {/* badges */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Insignias obtenidas</h2>
            <span className={styles.counter}>{profile.badges.length}</span>
          </div>

          {profile.badges.length > 0 ? (
            <div className={styles.badgeGrid}>
              {profile.badges.map((badge) => (
                <div key={badge.badgeid} className={styles.badge} title={badge.description}>
                  <img src={getBadgeIcon(badge.icon)} alt="" className={styles.badgeIcon} />
                  <strong>{badge.name}</strong>
                  <p>{badge.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.muted}>
              {isOwnProfile
                ? 'Aún no tienes insignias. Completa laboratorios para conseguirlas.'
                : 'Este usuario aún no tiene insignias.'}
            </p>
          )}
        </div>
      </>
    );
  };

  return (
    <>
      <main className={styles.page}>
        <div className={styles.container}>
          <span className={styles.eyebrow}>PERFIL DE USUARIO</span>

          {renderProfile()}

          {/* buscar otros usuarios */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Buscar usuarios</h2>
            </div>

            <input
              type="text"
              className={styles.searchInput}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value.slice(0, 50))}
              placeholder="Escribe un nombre de usuario..."
              aria-label="Buscar usuarios"
            />

            {searchText.trim() && (
              <ul className={styles.searchResults}>
                {searching && <li className={styles.muted}>Buscando...</li>}

                {!searching && searchResults.length === 0 && (
                  <li className={styles.muted}>Sin resultados.</li>
                )}

                {!searching &&
                  searchResults.map((result) => (
                    <li key={result.userid}>
                      <Link
                        to={`/perfil/${result.username}`}
                        className={styles.searchItem}
                        onClick={() => setSearchText('')}
                      >
                        <img
                          src={avatarMap[result.avatar] || avatarMap['avatar-01.svg']}
                          alt=""
                          className={styles.searchAvatar}
                        />
                        <span className={styles.searchName}>{result.username}</span>
                        <span className={styles.searchLevel}>Nv. {result.level}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}

export default ProfilePage;
