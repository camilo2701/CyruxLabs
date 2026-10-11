import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { avatarMap } from '../components/dashboard/AvatarSelector';
import BadgeIcon, { BADGE_TYPE_LABELS } from '../components/BadgeIcon';
import TrophyIcon from '../components/TrophyIcon';
import { TROPHY_TYPE_LABELS } from '../utils/labRules';
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
const BADGES_STEP = 8;
const TROPHY_LABS_STEP = 3;

const TROPHY_TYPE_CLASS = { 0: 'trophyBronze', 1: 'trophySilver', 2: 'trophyGold' };

function ShowMoreButton({ shown, total, step, unit, onChange }) {
  if (total <= step) return null;

  const remaining = total - shown;

  return (
    <div className={styles.showMore}>
      {remaining > 0 ? (
        <button type="button" onClick={() => onChange(shown + step)}>
          Ver más ({remaining} {unit}{remaining === 1 ? '' : 's'} restante{remaining === 1 ? '' : 's'})
        </button>
      ) : (
        <button type="button" onClick={() => onChange(step)}>
          Ver menos
        </button>
      )}
    </div>
  );
}

function ProfilePage() {
  const { username: usernameParam } = useParams();
  const { user, token, isLoading } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [visibleBadges, setVisibleBadges] = useState(BADGES_STEP);
  const [visibleLockedBadges, setVisibleLockedBadges] = useState(BADGES_STEP);
  const [visibleTrophyLabs, setVisibleTrophyLabs] = useState(TROPHY_LABS_STEP);

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
    setVisibleBadges(BADGES_STEP);
    setVisibleLockedBadges(BADGES_STEP);
    setVisibleTrophyLabs(TROPHY_LABS_STEP);

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
              <span>
                {profile.trophyCount} trofeo{profile.trophyCount === 1 ? '' : 's'}
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
              {profile.badges.slice(0, visibleBadges).map((badge) => (
                <div
                  key={badge.badgeid}
                  className={`${styles.badge} ${styles.trophy} ${styles[`badgeType${badge.type ?? 0}`] || ''}`}
                  title={badge.description}
                >
                  <strong>{badge.name}</strong>
                  <BadgeIcon category={badge.category} type={badge.type ?? 0} size={64} />
                  <span className={styles.trophyType}>{BADGE_TYPE_LABELS[badge.type ?? 0]}</span>
                  <p>{badge.description}</p>
                  <span className={styles.trophyDate}>{formatDate(badge.dateofunlock)}</span>
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

          <ShowMoreButton
            shown={visibleBadges}
            total={profile.badges.length}
            step={BADGES_STEP}
            unit="insignia"
            onChange={setVisibleBadges}
          />
        </div>

        {/* badges bloqueadas + su progreso */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Insignias sin desbloquear</h2>
            <span className={styles.counter}>{profile.lockedBadges.length}</span>
          </div>

          {profile.lockedBadges.length > 0 ? (
            <div className={styles.badgeGrid}>
              {profile.lockedBadges.slice(0, visibleLockedBadges).map((badge) => (
                <div
                  key={badge.badgeid}
                  className={`${styles.badge} ${styles.trophy} ${styles.badgeLocked}`}
                  title={badge.description}
                >
                  <span className={styles.lockIcon} aria-label="Bloqueada">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <strong>{badge.name}</strong>
                  <BadgeIcon category={badge.category} type={badge.type ?? 0} size={64} locked />
                  <span className={styles.trophyType}>{BADGE_TYPE_LABELS[badge.type ?? 0]}</span>
                  <p>{badge.description}</p>

                  {badge.progress && (
                    <div className={styles.badgeProgress}>
                      <div
                        className={styles.badgeProgressTrack}
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={badge.progress.percent}
                      >
                        <div className={styles.badgeProgressFill} style={{ width: `${badge.progress.percent}%` }} />
                      </div>
                      <span>{badge.progress.label}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.muted}>
              {isOwnProfile
                ? '¡Desbloqueaste todas las insignias!'
                : 'Este usuario desbloqueó todas las insignias.'}
            </p>
          )}

          <ShowMoreButton
            shown={visibleLockedBadges}
            total={profile.lockedBadges.length}
            step={BADGES_STEP}
            unit="insignia"
            onChange={setVisibleLockedBadges}
          />
        </div>

        {/* trophies agrupados por lab (más reciente primero) */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Trofeos obtenidos</h2>
            <span className={styles.counter}>{profile.trophyCount}</span>
          </div>

          {profile.trophyGroups.length > 0 ? (
            <div className={styles.trophyGroups}>
              {profile.trophyGroups.slice(0, visibleTrophyLabs).map((group) => (
                <section key={group.labid} className={styles.trophyGroup}>
                  <div className={styles.trophyGroupHeader}>
                    <h3>{group.title}</h3>
                    <span>
                      {group.trophies.length} trofeo{group.trophies.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className={styles.badgeGrid}>
                    {group.trophies.map((trophy) => (
                      <div
                        key={trophy.trophyid}
                        className={`${styles.badge} ${styles.trophy} ${styles[TROPHY_TYPE_CLASS[trophy.type]] || ''}`}
                        title={trophy.description}
                      >
                        <strong>{trophy.name}</strong>
                        <TrophyIcon type={trophy.type} size={56} className={styles.trophyIcon} />
                        <span className={styles.trophyType}>{TROPHY_TYPE_LABELS[trophy.type]}</span>
                        <p>{trophy.description}</p>
                        <span className={styles.trophyDate}>{formatDate(trophy.dateofunlock)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <p className={styles.muted}>
              {isOwnProfile
                ? 'Aún no tienes trofeos. Completa laboratorios para conseguirlos.'
                : 'Este usuario aún no tiene trofeos.'}
            </p>
          )}

          <ShowMoreButton
            shown={visibleTrophyLabs}
            total={profile.trophyGroups.length}
            step={TROPHY_LABS_STEP}
            unit="laboratorio"
            onChange={setVisibleTrophyLabs}
          />
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
