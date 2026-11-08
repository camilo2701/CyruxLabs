// Este archivo se encarga de formatear una cantidad de segundos como un tiempo legible (HH:MM:SS o MM:SS).

// Esta función se encarga de convertir un total de segundos en un texto de tiempo;
// muestra las horas solo cuando el tiempo supera la hora.
export function formatElapsed(totalSeconds) {
    // Nunca negativo y sin decimales: trabajamos con segundos enteros
    const s = Math.max(0, Math.floor(totalSeconds));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    // Rellena con un cero a la izquierda para que siempre se vean dos dígitos
    const pad = (n) => String(n).padStart(2, '0');
    return hh > 0 ? `${pad(hh)}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`;
}