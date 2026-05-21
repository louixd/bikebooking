# BikeBooking / BikeFlow

Application de réservation de vélos avec un frontend Vite/React, une API Flask et une base PostgreSQL dans Docker.

## Démarrage Docker

```powershell
docker compose up -d --build
```

Services exposés :

- Frontend: http://localhost:5173
- Backend: http://localhost:5000
- PostgreSQL: localhost:5432
- Mailpit: http://localhost:8025 (interface web), localhost:1025 (SMTP)

La base PostgreSQL est créée par le service `db` du `docker-compose.yml`. Au démarrage du backend, le schéma applicatif est initialisé automatiquement et les administrateurs Microsoft Entra ID sont synchronisés depuis la configuration.

## Connexion Microsoft Entra ID obligatoire

L'application lance automatiquement la connexion Microsoft Entra ID au démarrage et n'affiche pas le site tant que l'utilisateur n'est pas connecté. Configure une application SPA dans Entra ID, ajoute l'URL du frontend dans les URI de redirection, puis renseigne les variables suivantes.

Backend :

```text
ENTRA_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ENTRA_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ENTRA_ADMIN_EMAILS=admin@entreprise.fr,autre.admin@entreprise.fr
```

Frontend :

```text
VITE_ENTRA_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_ENTRA_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Les utilisateurs sont créés ou mis à jour automatiquement dans la table applicative après leur première connexion Microsoft. Le rôle admin est piloté par `ENTRA_ADMIN_EMAILS` ou, si besoin, `ENTRA_ADMIN_OBJECT_IDS` côté backend. Les emails séparent plusieurs admins par des virgules.

## Base de données

Le backend utilise `psycopg` et lit `DATABASE_URL` ou, à défaut, les variables `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER` et `POSTGRES_PASSWORD`.

En Docker, l'URL utilisée est :

```text
postgresql://bikeflow:bikeflow@db:5432/bikeflow
```

Les données PostgreSQL sont conservées dans le volume Docker `postgres-data`.

## CORS

Le backend accepte par défaut le frontend local et le frontend Render :

```text
http://localhost:5173
https://bikebooking-akyr.onrender.com
```

Tu peux ajouter d'autres origines avec `ALLOWED_ORIGINS`, séparées par des virgules.

## Emails de test

Docker Compose lance Mailpit pour intercepter les emails envoyés par le backend en environnement de test/dev.

Le backend est configuré avec :

```text
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_USE_TLS=0
```

Les emails capturés sont visibles dans l'interface Mailpit : http://localhost:8025

## Emails en déploiement Mailjet

En production, le backend peut utiliser Mailjet sans configurer manuellement le SMTP. Sur Render, ajoute ces variables d'environnement au service backend :

```text
MAILJET_API_KEY=...
MAILJET_SECRET_KEY=...
MAILJET_FROM_EMAIL=no-reply@votre-domaine.fr
MAILJET_FROM_NAME=BikeFlow
RESERVATION_NOTIFY_EMAIL=equipe@votre-domaine.fr
MAINTENANCE_EMAIL=maintenance@votre-domaine.fr
```

Quand `MAILJET_API_KEY` et `MAILJET_SECRET_KEY` sont présentes, le backend envoie via l'API Mailjet v3.1. Les noms officiels `MJ_APIKEY_PUBLIC` et `MJ_APIKEY_PRIVATE` sont aussi acceptés. En Docker local, Mailpit reste prioritaire grâce à `SMTP_HOST=mailpit`.