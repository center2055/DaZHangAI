export interface WordData {
  word: string;
  type: string;
  category: string;
}

const API_BASE_URL = 'http://localhost:5000/api';

export const fetchWord = async (level: string, useModel: boolean): Promise<WordData> => {
  try {
    let url = `${API_BASE_URL}/word?level=${level}`;
    if (useModel) {
      url += `&use_model=true`;
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching word:', error);
    // Biete ein Fallback-Wort, um die Anwendung am Laufen zu halten
    return { word: 'fallback', type: 'N/A', category: 'N/A' };
  }
};

export const fetchHint = async (word: string): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/hint?word=${word}`);
    if (!response.ok) {
      throw new Error('Hint could not be fetched.');
    }
    const data = await response.json();
    return data.hint;
  } catch (error) {
    console.error('Error fetching hint:', error);
    return 'Tipp konnte nicht geladen werden.';
  }
};

export const fetchFeedback = async (): Promise<string | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/feedback?user_id=default_user`);
    if (!response.ok) {
      throw new Error('Feedback could not be fetched.');
    }
    const data = await response.json();
    return data.feedback;
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return null;
  }
};

export const logGame = async (word: string, wrongGuesses: number, wasSuccessful: boolean): Promise<{ problem_letters: string[] }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/log_game`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word: word,
        wrongGuesses: wrongGuesses,
        wasSuccessful: wasSuccessful,
      }),
    });
    if (!response.ok) {
      throw new Error('Game could not be logged.');
    }
    return await response.json();
  } catch (error) {
    console.error('Error logging game:', error);
    return { problem_letters: [] };
  }
}; 