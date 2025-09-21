export interface User {
    username: string;
    role: 'student' | 'teacher';
    level?: string | null;
    age?: number | null;
    motherTongue?: string | null;
}

export interface Word {
    word: string;
    wordType: string;
    category?: string; // category is optional
    pre_revealed_letters?: string[]; // Letters revealed at start
    excluded_letters?: string[]; // Letters to cross out initially
}
