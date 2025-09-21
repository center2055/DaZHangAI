import React, { useState, useEffect, useCallback } from 'react';
import { getPlacementTestQuestions, submitPlacementTestResultsWithAuth } from '../gameApi';
import Hangman from './Hangman';
import { User, Word } from '../types';
import './PlacementTest.css'; // CSS für den Fortschrittsbalken importieren

interface PlacementTestProps {
    user: User;
    onTestComplete: (level: string) => void;
    token: string; // Add token prop
}

const PlacementTest: React.FC<PlacementTestProps> = ({ user, onTestComplete, token }) => {
    const [questions, setQuestions] = useState<Word[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() => {
        const savedIndex = localStorage.getItem(`placementTestIndex_${user.username}`);
        return savedIndex ? parseInt(savedIndex, 10) : 0;
    });
    const [correctAnswers, setCorrectAnswers] = useState(() => {
        const savedAnswers = localStorage.getItem(`placementTestCorrect_${user.username}`);
        return savedAnswers ? parseInt(savedAnswers, 10) : 0;
    });
    const [answeredSet, setAnsweredSet] = useState<Set<string>>(() => {
        const raw = localStorage.getItem(`placementTestAnswered_${user.username}`);
        return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    });

    useEffect(() => {
        localStorage.setItem(`placementTestIndex_${user.username}`, currentQuestionIndex.toString());
        localStorage.setItem(`placementTestCorrect_${user.username}`, correctAnswers.toString());
        localStorage.setItem(`placementTestAnswered_${user.username}`, JSON.stringify(Array.from(answeredSet)));
    }, [currentQuestionIndex, correctAnswers, answeredSet, user.username]);

    // Reset placement test when user changes - load their saved progress
    useEffect(() => {
        const savedIndex = localStorage.getItem(`placementTestIndex_${user.username}`);
        const savedAnswers = localStorage.getItem(`placementTestCorrect_${user.username}`);
        const savedAnswered = localStorage.getItem(`placementTestAnswered_${user.username}`);
        
        setCurrentQuestionIndex(savedIndex ? parseInt(savedIndex, 10) : 0);
        setCorrectAnswers(savedAnswers ? parseInt(savedAnswers, 10) : 0);
        setAnsweredSet(new Set(savedAnswered ? JSON.parse(savedAnswered) : []));
        setError(null);
        setIsSubmitting(false);
        
        // Clear any old generic placement test data
        localStorage.removeItem('placementTestIndex');
        localStorage.removeItem('placementTestCorrect');
    }, [user.username]);

    useEffect(() => {
        const fetchQuestions = async () => {
            try {
                setLoading(true);
                const fetchedQuestions = await getPlacementTestQuestions();
                // Map the API response to match the Word interface
                const mappedQuestions = fetchedQuestions.map(q => ({
                    word: q.word,
                    wordType: q.type, // Map 'type' to 'wordType'
                    category: q.category, // Now category is guaranteed to exist
                    pre_revealed_letters: q.pre_revealed_letters,
                    excluded_letters: q.excluded_letters
                }));
                const filtered = mappedQuestions.filter(q => !answeredSet.has(q.word));
                setQuestions(filtered);
            } catch (err) {
                setError('Fehler beim Laden des Einstufungstests.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchQuestions();
    }, [answeredSet]);

    const submitResults = useCallback(async () => {
        setIsSubmitting(true);
        try {
            const result = await submitPlacementTestResultsWithAuth(
                user.username,
                correctAnswers,
                questions.length,
                token
            );
            localStorage.removeItem(`placementTestIndex_${user.username}`);
            localStorage.removeItem(`placementTestCorrect_${user.username}`);
            localStorage.removeItem(`placementTestAnswered_${user.username}`);
            onTestComplete(result.level);
        } catch (err) {
            setError('Fehler beim Übermitteln der Ergebnisse.');
            console.error(err);
        }
        // isSubmitting bleibt true, da die Komponente nach dem Aufruf von onTestComplete verschwindet
    }, [user.username, correctAnswers, questions.length, onTestComplete, token]);

    const handleNextQuestion = useCallback((gameWon: boolean) => {
        if (gameWon) {
            setCorrectAnswers(prev => prev + 1);
        }
        // Mark answered to prevent repetition after refresh
        setAnsweredSet(prev => new Set(prev).add(questions[currentQuestionIndex].word));
        
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            submitResults();
        }
    }, [currentQuestionIndex, questions, submitResults]);

    if (loading) return <p>Einstufungstest wird geladen...</p>;
    if (error) return <p className="error-message">{error}</p>;
    if (isSubmitting) return <p>Ergebnisse werden übermittelt und dein Level wird berechnet...</p>;
    if (questions.length === 0) return <p>Keine Fragen für den Test gefunden.</p>;

    const currentQuestion = questions[currentQuestionIndex];
    const progressPercentage = (currentQuestionIndex / questions.length) * 100;

    return (
        <div className="placement-test-container">
            <h2>Einstufungstest</h2>
            <p>Finde das richtige Wort, um dein Sprachniveau zu ermitteln.</p>
            
            <div className="progress-container">
                <p>Frage {currentQuestionIndex + 1} von {questions.length}</p>
                <div className="progress-bar-background">
                    <div className="progress-bar-foreground" style={{ width: `${progressPercentage}%` }}></div>
                </div>
            </div>

            <Hangman
                key={currentQuestion.word}
                user={user}
                token={token}
                initialWord={currentQuestion}
                onGameEnd={handleNextQuestion}
                isPlacementTest={true}
            />
        </div>
    );
};

export default PlacementTest; 