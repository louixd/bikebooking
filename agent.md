# TABNINE.md — BikeFlow Demo App

> Fichier de référence pour Tabnine CLI. Toutes les directives ci-dessous ont la **priorité absolue** sur les comportements par défaut de l'agent.

---

## 1. Description du projet

Application de **réservation de vélos** en entreprise.

- **4 vélos** disponibles, identifiés de `VELO-1` à `VELO-4`.
- Les utilisateurs peuvent réserver un vélo du l'heure de debut a l'heure de fin (possiblement un autre jour).
- Aucune authentification requise : une réservation est liée à un **utilisateur** (`UserName` + `UserEmail`) existant dans la table `User`.
- Les réservations peuvent être **annulées** par l'utilisateur.

---

## 2. Architecture

### Conteneurs Docker

| Conteneur | Rôle             | Technologie         | Port interne |
|-----------|------------------|---------------------|--------------|
| `front`   | Interface web     | React + Vite (JS)   | `5173`       |
| `back`    | API REST          | Python + Flask      | `5000`       |
| `db`      | Base de donnees   | PostgreSQL          | `5432`       |

Communication entre conteneurs via le réseau Docker interne (`bikeflow-network`).

### Base de données

- **Moteur :** PostgreSQL dans Docker
- **Service Docker :** `db`
- **Base :** `bikeflow`
- **Driver Python :** `psycopg2`
- La chaîne de connexion est injectée via variable d'environnement (`DATABASE_URL`).

---

## 3. Modèle de données (PostgreSQL)

> Le schema est initialise automatiquement dans `back/app/db.py` au demarrage du backend.

### Table `dbo.Bike`

```sql
CREATE TABLE dbo.Bike (
    BikeId          INT           PRIMARY KEY,
    BikeName        NVARCHAR(100) NOT NULL,
    BikeSize        NVARCHAR(30)  NOT NULL,
    BikeCode        NVARCHAR(50)  NOT NULL,
    BikeDescription NVARCHAR(256) NOT NULL,
    IsAvailable     BIT           NOT NULL DEFAULT (1)
);
```

### Table `dbo.User`

```sql
CREATE TABLE dbo.[User] (
    UserId    INT           PRIMARY KEY,
    UserName  NVARCHAR(30)  NOT NULL,
    UserEmail NVARCHAR(100) NOT NULL,
    IsAdmin   BIT           NOT NULL DEFAULT (0)
);
```

### Table `dbo.Reservation`

```sql
CREATE TABLE dbo.Reservation (
    ReservationId   INT           PRIMARY KEY,
    ReservationCode NVARCHAR(50)  NOT NULL,
    ReservationDate DATETIME      NOT NULL,       -- créneau début (midi ou soir)
    ReturnDate      DATETIME      NOT NULL,       -- créneau fin
    IsValidate      BIT           NOT NULL DEFAULT (1),
    UserId          INT           NOT NULL REFERENCES dbo.[User](UserId),
    BikeId          INT           NOT NULL REFERENCES dbo.Bike(BikeId)
);
```

### Table `dbo.Return`

```sql
CREATE TABLE dbo.[Return] (
    ReturnId      INT            PRIMARY KEY,
    ReservationId INT            NOT NULL REFERENCES dbo.Reservation(ReservationId),
    ReturnDate    DATETIME       NOT NULL DEFAULT (GETDATE()),
    ProblemState  NVARCHAR(50)   NULL,
    ReturnState   NVARCHAR(50)   NULL,
    ReturnComment NVARCHAR(500)  NULL,
    BikeId        INT            NOT NULL REFERENCES dbo.Bike(BikeId)
);
```

### Table `dbo.Reparation`

```sql
CREATE TABLE dbo.Reparation (
    ReparationId          INT            PRIMARY KEY,
    ReparationDescription NVARCHAR(256)  NOT NULL,
    ReparationBeginDate   DATETIME       NOT NULL DEFAULT (GETDATE()),
    ReparationEndDate     DATETIME       NULL,
    ReparationCost        DECIMAL        NULL,
    BikeId                INT            NOT NULL REFERENCES dbo.Bike(BikeId)
);
```

### Relations (Foreign Keys)

```
Reservation.UserId      -> User.UserId
Reservation.BikeId      -> Bike.BikeId
Return.ReservationId    -> Reservation.ReservationId
Return.BikeId           -> Bike.BikeId
Reparation.BikeId       -> Bike.BikeId
```

### Notes importantes

- Les **créneaux** (midi/soir) ne sont pas une table dédiée : ils sont encodés via `ReservationDate` et `ReturnDate` dans `Reservation`.
- `IsAvailable` sur `Bike` indique si le vélo est utilisable (non en réparation).
- `IsValidate` sur `Reservation` permet d'annuler une réservation (soft delete : passer à `0`).
- `IsAdmin` sur `User` distingue les administrateurs (gestion des créneaux, réparations).

---

## 4. Backend (Flask / Python)

### Structure de fichiers attendue

```
back/
├── app/
│   ├── __init__.py          # Factory Flask (create_app)
│   ├── config.py            # Config depuis variables d'env
│   ├── db.py                # Connexion PostgreSQL
│   ├── routes/
│   │   ├── bikes.py         # GET /bikes, GET /bikes/:id
│   │   ├── users.py         # GET /users, POST /users
│   │   ├── reservations.py  # GET, POST /reservations, PATCH /reservations/:id/cancel
│   │   ├── returns.py       # GET, POST /returns
│   │   └── reparations.py   # GET, POST /reparations, PATCH /reparations/:id/close
│   └── models/              # Dataclasses ou dict-mappers
├── requirements.txt
├── Dockerfile
└── .env.example
```

### Conventions

- **Style :** PEP 8 strict. Docstrings sur toutes les fonctions publiques.
- **Réponses JSON :** snake_case pour toutes les clés.
- **Gestion d'erreurs :** `abort()` Flask avec codes HTTP sémantiques (400, 404, 409 pour conflit de réservation).
- **Pas d'ORM :** Requêtes SQL directes via `psycopg2` pour garder la simplicité du projet demo.
- **CORS :** Activé pour `http://localhost:5173` via `flask-cors`.
- **Tests :** `pytest` avec `pytest-flask`. Chaque route doit avoir au minimum un test de succès et un test d'erreur.

### Variables d'environnement (`.env`)

```
DATABASE_URL=postgresql://bikeflow:bikeflow@db:5432/bikeflow
FLASK_ENV=development
FLASK_DEBUG=1
ALLOWED_ORIGIN=http://localhost:5173
```

---

## 5. Frontend (React + Vite / JavaScript)

### Structure de fichiers attendue

```
front/
├── src/
│   ├── api/
│   │   └── bikeflowApi.js   # Toutes les fonctions fetch vers le back
│   ├── components/
│   │   ├── BikeCard.jsx
│   │   ├── SlotPicker.jsx
│   │   ├── ReservationForm.jsx
│   │   └── ReservationList.jsx
│   ├── pages/
│   │   ├── HomePage.jsx     # Vue calendrier / réservation
│   │   └── AdminPage.jsx    # Configuration des créneaux
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── vite.config.js
├── package.json
└── Dockerfile
```

### Conventions

- **Langage :** JavaScript (pas TypeScript pour ce projet demo).
- **Style :** Vanilla CSS uniquement — pas de TailwindCSS, pas de Bootstrap.
- **Composants :** Fonctionnels avec hooks React (`useState`, `useEffect`).
- **Appels API :** Centralisés dans `src/api/bikeflowApi.js`, jamais inline dans les composants.
- **Gestion d'état :** Local state uniquement (pas de Redux/Zustand pour ce projet demo).
- **Variables d'environnement :** `VITE_API_URL` pour l'URL du backend.

### Variable d'environnement (`.env`)

```
VITE_API_URL=http://localhost:5000
```

---

## 6. Docker Compose

```yaml
# docker-compose.yml (référence)
services:
  back:
    build: ./back
    ports:
      - "5000:5000"
    env_file: ./back/.env
    networks:
      - bikeflow-network

  front:
    build: ./front
    ports:
      - "5173:5173"
    env_file: ./front/.env
    depends_on:
      - back
    networks:
      - bikeflow-network

networks:
  bikeflow-network:
    driver: bridge
```

---

## 7. Règles de sécurité & bonnes pratiques

- **Jamais** commiter les fichiers `.env`. Seuls les `.env.example` sont versionnés.
- **Jamais** exposer la chaîne de connexion Azure SQL dans le code source.
- Valider toutes les entrées utilisateur côté backend avant insertion en base.
- Désactiver le mode debug Flask en production.

---

## 8. Contraintes de développement (directives Tabnine)

- Ne jamais utiliser de librairie non listée dans `requirements.txt` ou `package.json` sans le signaler.
- Vérifier la disponibilité d'un vélo (`IsAvailable = 1`) et l'absence de réservation active sur le créneau avant tout `INSERT` en `Reservation`.
- Toujours utiliser des **requêtes paramétrées** (jamais de concaténation de chaîne SQL).
- Respecter la séparation stricte front/back : le frontend ne connaît pas la base de données.
- Avant tout commit de migration SQL, vérifier la compatibilité avec PostgreSQL.

---

## 9. Endpoints API attendus

### Vélos (`Bike`)

| Méthode | Route            | Description                                      |
|---------|------------------|--------------------------------------------------|
| GET     | `/bikes`         | Liste tous les vélos (`IsAvailable` inclus)      |
| GET     | `/bikes/:id`     | Détail d'un vélo                                 |

### Utilisateurs (`User`)

| Méthode | Route            | Description                                      |
|---------|------------------|--------------------------------------------------|
| GET     | `/users`         | Liste tous les utilisateurs                      |
| POST    | `/users`         | Créer un utilisateur (nom, email)                |

### Réservations (`Reservation`)

| Méthode | Route                    | Description                                                    |
|---------|--------------------------|----------------------------------------------------------------|
| GET     | `/reservations`          | Liste des réservations (filtre par date, bikeId, userId)       |
| GET     | `/reservations/:id`      | Détail d'une réservation                                       |
| POST    | `/reservations`          | Créer une réservation (bikeId, userId, ReservationDate, ReturnDate) |
| PATCH   | `/reservations/:id/cancel` | Annuler une réservation (met `IsValidate = 0`)               |

### Retours (`Return`)

| Méthode | Route            | Description                                                  |
|---------|------------------|--------------------------------------------------------------|
| POST    | `/returns`       | Enregistrer un retour (reservationId, bikeId, état, commentaire) |
| GET     | `/returns/:reservationId` | Retour associé à une réservation                   |

### Réparations (`Reparation`)

| Méthode | Route                | Description                                              |
|---------|----------------------|----------------------------------------------------------|
| GET     | `/reparations`       | Liste des réparations (filtre par bikeId)                |
| POST    | `/reparations`       | Ouvrir une réparation (bikeId, description)              |
| PATCH   | `/reparations/:id/close` | Clore une réparation (endDate, cost)               |

---

*Dernière mise à jour : 2026-05-18*
