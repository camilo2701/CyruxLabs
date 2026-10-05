import badgeFallback from '../assets/badges/badge-test.png';

// carga automatica de todas las badges de assets/
const modules = import.meta.glob('../assets/badges/*.{png,svg,webp,jpg}', {
  eager: true,
  import: 'default',
});

export const badgeIconMap = Object.fromEntries(
  Object.entries(modules).map(([path, url]) => [path.split('/').pop(), url])
);

export function getBadgeIcon(iconFile) {
  return badgeIconMap[iconFile] || badgeFallback;
}
