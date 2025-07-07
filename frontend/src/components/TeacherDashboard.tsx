import React, { useState, useEffect } from 'react';
import { fetchStudentsData } from '../authApi';
import './TeacherDashboard.css';

interface StudentData {
    username: string;
    progress: {
        failed_words: number;
        problem_letters: string[];
    };
}

const TeacherDashboard: React.FC = () => {
    const [students, setStudents] = useState<StudentData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadData = async () => {
            try {
                const data = await fetchStudentsData();
                setStudents(data);
            } catch (err) {
                setError('Daten konnten nicht geladen werden.');
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    if (loading) return <p>Lade Schülerdaten...</p>;
    if (error) return <p className="error-message">{error}</p>;

    return (
        <div className="dashboard-container">
            <h2>Lehrer-Dashboard</h2>
            <table className="students-table">
                <thead>
                    <tr>
                        <th>Schüler</th>
                        <th>Anzahl Fehler</th>
                        <th>Problembuchstaben</th>
                    </tr>
                </thead>
                <tbody>
                    {students.map(student => (
                        <tr key={student.username}>
                            <td>{student.username}</td>
                            <td>{student.progress.failed_words || 0}</td>
                            <td>{student.progress.problem_letters?.join(', ') || 'Keine'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default TeacherDashboard; 