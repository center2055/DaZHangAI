const API_BASE_URL = '/api'; // Relative URL verwenden
const API_BASE_URL_V2 = '/api/v2';

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error Response:", errorText);
        throw new Error(`API-Fehler: ${response.status} ${response.statusText}. Server-Antwort: ${errorText}`);
    }
    // Sicherstellen, dass die Antwort auch wirklich JSON enthält, bevor wir parsen
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        return response.json() as Promise<T>;
    } else {
        // Wenn kein JSON, dann Text zurückgeben und im aufrufenden Code behandeln
        // In diesem Fall werfen wir einen Fehler, da wir JSON erwarten.
        const errorText = await response.text();
        throw new Error(`Unerwartete Server-Antwort (kein JSON): ${errorText.substring(0, 100)}...`);
    }
}

export const getWord = async (level: string, useModel: boolean, token: string): Promise<{ word: string, type: string, category: string, pre_revealed_letters?: string[], excluded_letters?: string[] }> => {
    const response = await fetch(`${API_BASE_URL}/word?level=${level}&use_model=${useModel}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return handleResponse(response);
};

export const logGame = async (
    word: string,
    wordType: string,
    wasSuccessful: boolean,
    wrongGuesses: number,
    token: string,
    wrongLetters?: string[]
): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/log_game`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ word, wordType, wasSuccessful, wrongGuesses, wrongLetters }),
    });
    return handleResponse(response);
};

export const getFeedback = async (token: string): Promise<{ feedback: string | null }> => {
    const response = await fetch(`${API_BASE_URL}/feedback`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return handleResponse(response);
};

export const getPlacementTestQuestions = async (): Promise<{ word: string, type: string, category: string, pre_revealed_letters?: string[], excluded_letters?: string[] }[]> => {
    const response = await fetch(`${API_BASE_URL}/placement-test/questions`);
    return handleResponse(response);
};

export const submitPlacementTestResults = async (username: string, correctAnswers: number, totalQuestions: number): Promise<{ level: string }> => {
    // Deprecated signature kept for backward compatibility; prefer submitPlacementTestResultsWithAuth
    const response = await fetch(`${API_BASE_URL}/placement-test/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, correct_answers: correctAnswers, total_questions: totalQuestions }),
    });
    return handleResponse(response);
};

export const submitPlacementTestResultsWithAuth = async (
    username: string,
    correctAnswers: number,
    totalQuestions: number,
    token: string
): Promise<{ level: string }> => {
    const response = await fetch(`${API_BASE_URL}/placement-test/submit`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username, correct_answers: correctAnswers, total_questions: totalQuestions }),
    });
    return handleResponse(response);
};

export const getHintForWord = async (word: string): Promise<{ hint: string }> => {
    const response = await fetch(`${API_BASE_URL}/hint?word=${encodeURIComponent(word)}`);
    return handleResponse(response);
};

export const getUserStatistics = async (token: string): Promise<{ wins: number, losses: number, total_games: number, win_rate: number, seen_words: number, failed_words: number, problem_letters: string[] }> => {
    const response = await fetch(`${API_BASE_URL}/user/statistics`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return handleResponse(response);
};

export const consumeHintCredit = async (
    word: string,
    guessedLetters: string[],
    token: string
): Promise<{ revealed_letter: string; hint_credits: number }> => {
    const response = await fetch(`${API_BASE_URL_V2}/use_hint`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ word, guessed_letters: guessedLetters })
    });
    return handleResponse(response);
};
