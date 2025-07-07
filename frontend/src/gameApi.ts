const API_BASE_URL = '/api';

// Corresponds to the new game setup endpoint
export const getGameData = async (level: string, useModel: boolean, username: string) => {
    const params = new URLSearchParams({
        level,
        use_model: String(useModel),
        username,
    });
    const response = await fetch(`${API_BASE_URL}/word?${params.toString()}`);
    if (!response.ok) {
        throw new Error('Spiel konnte nicht gestartet werden');
    }
    return response.json();
};

// This function seems unused in Hangman.tsx now, but let's keep it for now
export const postGuess = async (username: string, letter: string) => {
    const response = await fetch(`${API_BASE_URL}/guess`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, letter }),
    });
    if (!response.ok) {
        throw new Error('Rateversuch konnte nicht verarbeitet werden');
    }
    return response.json();
};


// The startNewGame in Hangman.tsx actually calls getGameData.
// If a separate "start new game" API call without returning data is needed, it can be added here.
// For now, we alias getGameData for clarity if needed elsewhere.
export const startNewGame = getGameData;


export const getHint = async (word: string) => {
    const response = await fetch(`${API_BASE_URL}/hint?word=${encodeURIComponent(word)}`);
    if (!response.ok) {
        throw new Error('Hinweis konnte nicht geladen werden');
    }
    return response.json();
};

export const postGameResult = async (username: string, word: string, mistakes: number, won: boolean) => {
    const response = await fetch(`${API_BASE_URL}/log_game`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            username,
            word,
            mistakes,
            won,
        }),
    });
    if (!response.ok) {
        throw new Error('Spielergebnis konnte nicht gespeichert werden');
    }
    return response.json();
};