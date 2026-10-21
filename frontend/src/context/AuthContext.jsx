import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

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

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

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

    // Si cualquier petición con token recibe SESSION_INVALID, se cierra la sesión.
    // Se hace aquí una sola vez para no tocar cada fetch de la app.
    useEffect(() => {
        const originalFetch = window.fetch;

        window.fetch = async (...args) => {
            const response = await originalFetch(...args);
            const [resource, options] = args;
            const headers = new Headers(options?.headers ?? (resource instanceof Request ? resource.headers : undefined));

            if (headers.get('Authorization')?.startsWith('Bearer ') && await isSessionInvalid(response)) {
                logout();
            }
            return response;
        };

        return () => {
            window.fetch = originalFetch;
        };
    }, []);

    // LoginModal y RegisterPage llaman a esto con lo que devuelve el backend.
    function login({ token: newToken, user: newUser }) {
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
    }

    function logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
    }

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

// Hook para usar en cualquier componente: const { user, logout } = useAuth();
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth debe usarse dentro de un <AuthProvider>');
    }
    return context;
}