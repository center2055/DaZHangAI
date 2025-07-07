import { User } from './types';

const API_BASE_URL = '/api/v2'; // Changed to relative path

export const login = async (username: string, password: string): Promise<{ success: boolean; user?: User; message?: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, message: data.message || 'Login fehlgeschlagen' };
    }
    return data;
  } catch (error) {
    return { success: false, message: 'Netzwerk- oder Serverfehler' };
  }
};

export const register = async (username: string, password: string): Promise<{ success: boolean; message?: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    return { success: response.ok, ...data };
  } catch (error) {
    return { success: false, message: 'Netzwerkfehler' };
  }
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
}; 

export const fetchStudentsData = async () => {
    const response = await fetch(`${API_BASE_URL}/students_data`);
    if (!response.ok) {
        throw new Error('Schülerdaten konnten nicht geladen werden');
    }
    return response.json();
};