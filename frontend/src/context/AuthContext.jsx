// Este archivo se encarga de la autenticación: guarda el usuario y el token, los expone por contexto
// y cierra la sesión automáticamente cuando el backend indica que el token dejó de ser válido.
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Esta función se encarga de detectar si una respuesta 401 corresponde a una sesión inválida.
// El backend responde este código cuando el token ya no sirve (vencido o cuenta eliminada).
// Otros 401 no cierran la sesión.
async function isSessionInvalid(response) {
    if (response.status !== 401) return false;
    try {
        const data = await response.clone().json();
        return data?.code === 'SESSION_INVALID';
    } catch {
        return false;
    }
}

// Este componente se encarga de proveer el estado de autenticación a toda la app mediante el contexto.
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Este efecto se encarga de restaurar la sesión guardada al iniciar y validarla contra el backend.
    // Al cargar la app, revisa si ya había una sesión guardada de antes
    // (por ejemplo, si el usuario recarga la página).
    // Luego confirma con el backend que el token sigue válido y trae el usuario
    // actualizado (por ejemplo, si un admin le cambió el rol).
    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (!storedToken || !storedUser) {
            setIsLoading(false);
            return;
        }

        try {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
        } catch (err) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setIsLoading(false);
            return;
        }

        fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${storedToken}` } })
            .then(async (response) => {
                if (await isSessionInvalid(response)) {
                    logout();
                    return;
                }
                if (!response.ok) return;
                const data = await response.json();
                if (data?.user) updateUser(data.user);
            })
            // Si el backend no responde, se mantiene lo guardado
            .catch(() => {})
            .finally(() => setIsLoading(false));
    }, []);

    // Este efecto se encarga de envolver window.fetch para cerrar sesión ante cualquier SESSION_INVALID.
    // Si cualquier petición con token recibe SESSION_INVALID, se cierra la sesión.
    // Se hace aquí una sola vez para no tocar cada fetch de la app.
    useEffect(() => {
        const originalFetch = window.fetch;

        window.fetch = async (...args) => {
            const response = await originalFetch(...args);
            const [resource, options] = args;
            // Reconstruye las cabeceras de la petición para saber si llevaba un token Bearer
            const headers = new Headers(options?.headers ?? (resource instanceof Request ? resource.headers : undefined));

            // Solo cierra sesión si la petición iba autenticada y el backend marcó la sesión como inválida
            if (headers.get('Authorization')?.startsWith('Bearer ') && await isSessionInvalid(response)) {
                logout();
            }
            return response;
        };

        return () => {
            window.fetch = originalFetch;
        };
    }, []);

    // Esta función se encarga de iniciar sesión: guarda token y usuario en localStorage y en el estado.
    // LoginModal y RegisterPage llaman a esto con lo que devuelve el backend.
    function login({ token: newToken, user: newUser }) {
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
    }

    // Esta función se encarga de cerrar sesión: borra token y usuario de localStorage y del estado.
    function logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
    }

    // Esta función se encarga de actualizar los datos del usuario sin cambiar el token.
    // Para cambios que no requieren un token nuevo (ej. cambiar el avatar).
    function updateUser(newUser) {
        localStorage.setItem('user', JSON.stringify(newUser));
        setUser(newUser);
    }

    const value = {
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        logout,
        updateUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Este hook se encarga de dar acceso al contexto de autenticación desde cualquier componente.
// Hook para usar en cualquier componente: const { user, logout } = useAuth();
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth debe usarse dentro de un <AuthProvider>');
    }
    return context;
}