export interface User {
  username: string;
  role: 'student' | 'teacher';
}
 
export interface WordData {
  word: string;
  type: string;
  category: string;
} 