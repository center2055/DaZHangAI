import os
import random
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

WORDLISTS_DIR = os.path.join(os.path.dirname(__file__), 'word_lists')

def get_words(level='a1'):
    # Sicherheitsüberprüfung, um nur a1, a2, b1 zuzulassen
    safe_level = ''.join(filter(str.isalnum, level))
    if f"{safe_level}.txt" not in os.listdir(WORDLISTS_DIR):
        safe_level = 'a1' # Fallback auf a1

    filepath = os.path.join(WORDLISTS_DIR, f"{safe_level}.txt")
    with open(filepath, 'r', encoding='utf-8') as f:
        return [line.strip() for line in f]

@app.route('/api/word')
def get_word():
    level = request.args.get('level', default='a1', type=str)
    problem_letters_str = request.args.get('problem_letters', default='', type=str)
    
    words = get_words(level)
    
    if problem_letters_str:
        problem_letters = problem_letters_str.lower().split(',')
        # Filtere die Wortliste, um Wörter zu finden, die mindestens einen der Problembuchstaben enthalten
        candidate_words = [
            word for word in words 
            if any(char in word.lower() for char in problem_letters)
        ]
        
        if candidate_words:
            # Wenn passende Wörter gefunden wurden, wähle eines davon
            word = random.choice(candidate_words)
            return jsonify({'word': word})

    # Fallback: Wenn keine Problembuchstaben angegeben wurden oder keine passenden Wörter gefunden wurden
    word = random.choice(words)
    return jsonify({'word': word})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if username == 'admin' and password == 'password':
        return jsonify({'success': True, 'message': 'Login successful'})
    else:
        return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

if __name__ == '__main__':
    app.run(debug=True) 