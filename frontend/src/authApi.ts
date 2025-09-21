import { User } from './types';

const API_BASE_URL = '/api/v2'; // Changed to relative path

export interface LoginResponse {
  message: string;
  user: User;
  token: string;
}

export const login = async (username: string, password: string): Promise<LoginResponse> => {
  const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login fehlgeschlagen');
    }
    
    return data;
};

export const register = async (username: string, password: string, age: string, motherTongue: string): Promise<{success: boolean, message?: string}> => {
    const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password, age, motherTongue })
    });
    let data: any = {};
    try {
        data = await response.json();
    } catch {}
    return { success: response.ok, message: data?.message };
};

export const logout = async (username: string) => {
    const response = await fetch(`${API_BASE_URL}/logout`, { // uses relative path now
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
    });

    if (!response.ok) {
      // Even if logout fails on the server, we might want to proceed on the client.
      // For now, we'll log the error but not throw, allowing the client to clear session state regardless.
      console.error('Logout failed on server');
    }
    
    // Clear client-side user data
    localStorage.removeItem('user');
    localStorage.removeItem('token'); // Auch das Token entfernen
}; 

export const deleteStudent = async (username: string, token: string): Promise<{ success: boolean; message?: string }> => {
    try {
        const response = await fetch(`${API_BASE_URL}/user/${username}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        if (!response.ok) {
            return { success: false, message: data.message || 'Löschen fehlgeschlagen.' };
        }
        return { success: true, message: data.message };
    } catch (error) {
        return { success: false, message: 'Netzwerk- oder Serverfehler.' };
    }
};

export const fetchStudentsData = async (token: string) => {
    const response = await fetch(`${API_BASE_URL}/students_data`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!response.ok) {
        // Bei 401 oder 403 (ungültiges Token) könnte man hier eine spezielle Fehlerbehandlung einbauen, z.B. automatisches Ausloggen
        const errorData = await response.json();
        throw new Error(errorData.message || 'Schülerdaten konnten nicht geladen werden');
    }
    return response.json();
};
