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


if __name__ == '__main__':
    with app.app_context():
        # Erstellt alle Tabellen, falls sie nicht existieren
        db.create_all()
    
    migrate_users()
    migrate_profiles()
    print("\nMigration abgeschlossen.") 