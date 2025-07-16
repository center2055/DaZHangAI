import React, { useState, useEffect, useCallback } from 'react';
import { getPlacementTestQuestions, submitPlacementTestResults } from '../gameApi';
import Hangman from './Hangman';
import { User, Word } from '../types';
import './PlacementTest.css'; // CSS für den Fortschrittsbalken importieren

interface PlacementTestProps {
    user: User;
    onTestComplete: (level: string) => void;
}

const PlacementTest: React.FC<PlacementTestProps> = ({ user, onTestComplete }) => {
    const [questions, setQuestions] = useState<Word[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [correctAnswers, setCorrectAnswers] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchQuestions = async () => {
            try {
                setLoading(true);
                const fetchedQuestions = await getPlacementTestQuestions();
                setQuestions(fetchedQuestions);
            } catch (err) {
                setError('Fehler beim Laden des Einstufungstests.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchQuestions();
    }, []);

    const submitResults = useCallback(async () => {
        setIsSubmitting(true);
        try {
            const result = await submitPlacementTestResults(user.username, correctAnswers, questions.length);
            onTestComplete(result.level);
        } catch (err) {
            setError('Fehler beim Übermitteln der Ergebnisse.');
            console.error(err);
        }
        // isSubmitting bleibt true, da die Komponente nach dem Aufruf von onTestComplete verschwindet
    }, [user.username, correctAnswers, questions.length, onTestComplete]);

    const handleNextQuestion = useCallback((gameWon: boolean) => {
        if (gameWon) {
            setCorrectAnswers(prev => prev + 1);
        }
        
        setTimeout(() => {
            if (currentQuestionIndex < questions.length - 1) {
                setCurrentQuestionIndex(prev => prev + 1);
            } else {
                submitResults();
            }
        }, 1500);
    }, [currentQuestionIndex, questions.length, submitResults]);

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
                initialWord={currentQuestion}
                onGameEnd={handleNextQuestion}
                isPlacementTest={true}
            />
        </div>
    );
};

export default PlacementTest; 