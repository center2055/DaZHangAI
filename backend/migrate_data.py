import json
from werkzeug.security import check_password_hash
from app import app, db, User, UserProfile

def migrate_users():
    """Migriert Benutzer von users.json zur SQLite-Datenbank."""
    print("Starte Benutzermigration...")
    try:
        with open('backend/users.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print("users.json nicht gefunden. Überspringe Benutzermigration.")
        return

    with app.app_context():
        for username, user_data in data.items():
            # Überprüfen, ob der Benutzer bereits existiert
            if User.query.filter_by(username=username).first():
                print(f"Benutzer '{username}' existiert bereits. Überspringe.")
                continue

            new_user = User(
                username=username,
                password_hash=user_data['password_hash'],
                role=user_data.get('role', 'student'),
                level=user_data.get('level')
            )
            db.session.add(new_user)
            print(f"Benutzer '{username}' zur Sitzung hinzugefügt.")

        db.session.commit()
        print("Benutzer erfolgreich in die Datenbank migriert.")

def migrate_profiles():
    """Migriert Benutzerprofile von user_profiles.json zur SQLite-Datenbank."""
    print("\nStarte Profil-Migration...")
    try:
        with open('backend/user_profiles.json', 'r', encoding='utf-8') as f:
            profiles_data = json.load(f)
    except FileNotFoundError:
        print("user_profiles.json nicht gefunden. Überspringe Profil-Migration.")
        return

    with app.app_context():
        for username, profile_data in profiles_data.items():
            user = User.query.filter_by(username=username).first()
            if not user:
                print(f"Benutzer '{username}' für Profil nicht gefunden. Überspringe.")
                continue

            # Überprüfen, ob bereits ein Profil existiert
            if user.profile:
                print(f"Profil für '{username}' existiert bereits. Überspringe.")
                continue
            
            new_profile = UserProfile(
                user_id=user.id,
                seen_words=profile_data.get('seen_words', []),
                failed_words=profile_data.get('failed_words', {}),
                problem_letters=profile_data.get('problem_letters', []),
                failed_word_types=profile_data.get('failed_word_types', {})
            )
            db.session.add(new_profile)
            print(f"Profil für '{username}' zur Sitzung hinzugefügt.")

        db.session.commit()
        print("Profile erfolgreich in die Datenbank migriert.")


def migrate_schema():
    """Fügt neue Spalten zur bestehenden Datenbank hinzu, falls sie fehlen."""
    print("\nStarte Schema-Migration...")
    from sqlalchemy import inspect, text
    from sqlalchemy.exc import OperationalError

    with app.app_context():
        inspector = inspect(db.engine)
        
        # Spalte 'difficulty_modifier' zur 'user_profile' Tabelle hinzufügen
        try:
            columns = [c['name'] for c in inspector.get_columns('user_profile')]
            if 'difficulty_modifier' not in columns:
                print("Füge Spalte 'difficulty_modifier' zur Tabelle 'user_profile' hinzu...")
                with db.engine.connect() as connection:
                    connection.execute(text('ALTER TABLE user_profile ADD COLUMN difficulty_modifier FLOAT NOT NULL DEFAULT 1.0;'))
                print("Spalte 'difficulty_modifier' erfolgreich hinzugefügt.")
            else:
                print("Spalte 'difficulty_modifier' existiert bereits.")
        except OperationalError as e:
            # Dieser Fehler kann auftreten, wenn die Tabelle noch nicht existiert.
            # db.create_all() wird sich darum kümmern.
            print(f"Konnte Schema für 'user_profile' nicht prüfen/ändern: {e}")

        # Spalte 'hint_credits' hinzufügen
        try:
            columns = [c['name'] for c in inspector.get_columns('user_profile')]
            if 'hint_credits' not in columns:
                print("Füge Spalte 'hint_credits' zur Tabelle 'user_profile' hinzu...")
                with db.engine.connect() as connection:
                    connection.execute(text('ALTER TABLE user_profile ADD COLUMN hint_credits INTEGER NOT NULL DEFAULT 0;'))
                print("Spalte 'hint_credits' erfolgreich hinzugefügt.")
            else:
                print("Spalte 'hint_credits' existiert bereits.")
        except OperationalError as e:
            print(f"Konnte Spalte 'hint_credits' nicht hinzufügen/prüfen: {e}")

        # Spalte 'wins_since_last_hint' hinzufügen
        try:
            columns = [c['name'] for c in inspector.get_columns('user_profile')]
            if 'wins_since_last_hint' not in columns:
                print("Füge Spalte 'wins_since_last_hint' zur Tabelle 'user_profile' hinzu...")
                with db.engine.connect() as connection:
                    connection.execute(text('ALTER TABLE user_profile ADD COLUMN wins_since_last_hint INTEGER NOT NULL DEFAULT 0;'))
                print("Spalte 'wins_since_last_hint' erfolgreich hinzugefügt.")
            else:
                print("Spalte 'wins_since_last_hint' existiert bereits.")
        except OperationalError as e:
            print(f"Konnte Spalte 'wins_since_last_hint' nicht hinzufügen/prüfen: {e}")

if __name__ == '__main__':
    with app.app_context():
        # Erstellt alle Tabellen, falls sie nicht existieren
        db.create_all()
    
    migrate_schema()
    migrate_users()
    migrate_profiles()
    print("\nMigration abgeschlossen.") 