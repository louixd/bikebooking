# BikeBooking / BikeFlow

Application de reservation de velos avec un frontend Vite/React, une API Flask et une base PostgreSQL dans Docker.

## Demarrage Docker

```powershell
docker compose up -d --build
```

Services exposes:

- Frontend: http://localhost:5173
- Backend: http://localhost:5000
- PostgreSQL: localhost:5432
- Mailpit: http://localhost:8025 (interface web), localhost:1025 (SMTP)

La base PostgreSQL est creee par le service `db` du `docker-compose.yml`. Au demarrage du backend, le schema applicatif est initialise automatiquement et les administrateurs Microsoft Entra ID sont synchronises depuis la configuration.

## Connexion Microsoft Entra ID obligatoire

L'application lance automatiquement la connexion Microsoft Entra ID au demarrage et n'affiche pas le site tant que l'utilisateur n'est pas connecte. Configure une application SPA dans Entra ID, ajoute l'URL du frontend dans les redirect URIs, puis renseigne les variables suivantes.

Backend:

```text
ENTRA_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ENTRA_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ENTRA_ADMIN_EMAILS=admin@entreprise.fr,autre.admin@entreprise.fr
```

Frontend:

```text
VITE_ENTRA_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_ENTRA_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Les utilisateurs sont crees ou mis a jour automatiquement dans la table applicative apres leur premiere connexion Microsoft. Le role admin est pilote par `ENTRA_ADMIN_EMAILS` ou, si besoin, `ENTRA_ADMIN_OBJECT_IDS` cote backend. Les emails separent plusieurs admins par des virgules.

## Base de donnees

Le backend utilise `psycopg` et lit `DATABASE_URL` ou, a defaut, les variables `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER` et `POSTGRES_PASSWORD`.

En Docker, l'URL utilisee est:

```text
postgresql://bikeflow:bikeflow@db:5432/bikeflow
```

Les donnees PostgreSQL sont conservees dans le volume Docker `postgres-data`.

## CORS

Le backend accepte par defaut le frontend local et le frontend Render:

```text
http://localhost:5173
https://bikebooking-akyr.onrender.com
```

Tu peux ajouter d'autres origines avec `ALLOWED_ORIGINS`, separees par des virgules.

## Emails de test

Docker Compose lance Mailpit pour intercepter les emails envoyes par le backend en environnement de test/dev.

Le backend est configure avec:

```text
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_USE_TLS=0
```

Les emails captures sont visibles dans l'interface Mailpit: http://localhost:8025

## Emails en deploiement Mailjet

En production, le backend peut utiliser Mailjet sans configurer manuellement le SMTP. Sur Render, ajoute ces variables d'environnement au service backend:

```text
MAILJET_API_KEY=...
MAILJET_SECRET_KEY=...
MAILJET_FROM_EMAIL=no-reply@votre-domaine.fr
MAILJET_FROM_NAME=BikeFlow
RESERVATION_NOTIFY_EMAIL=equipe@votre-domaine.fr
MAINTENANCE_EMAIL=maintenance@votre-domaine.fr
```

Quand `MAILJET_API_KEY` et `MAILJET_SECRET_KEY` sont presentes, le backend envoie via l'API Mailjet v3.1. Les noms officiels `MJ_APIKEY_PUBLIC` et `MJ_APIKEY_PRIVATE` sont aussi acceptes. En Docker local, Mailpit reste prioritaire grace a `SMTP_HOST=mailpit`.