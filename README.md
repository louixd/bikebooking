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

La base PostgreSQL est creee par le service `db` du `docker-compose.yml`. Au demarrage du backend, le schema applicatif est initialise automatiquement et le compte admin local est seed depuis les variables `LOCAL_ADMIN_*`.

## Base de donnees

Le backend utilise `psycopg` et lit `DATABASE_URL` ou, a defaut, les variables `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER` et `POSTGRES_PASSWORD`.

En Docker, l'URL utilisee est:

```text
postgresql://bikeflow:bikeflow@db:5432/bikeflow
```

Les donnees PostgreSQL sont conservees dans le volume Docker `postgres-data`.

## Emails de test

Docker Compose lance Mailpit pour intercepter les emails envoyes par le backend en environnement de test/dev.

Le backend est configure avec:

```text
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_USE_TLS=0
```

Les emails captures sont visibles dans l'interface Mailpit: http://localhost:8025