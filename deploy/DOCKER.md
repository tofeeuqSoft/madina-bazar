# Docker Deploy — Madina Bazar

## Requirements
- Docker + Docker Compose v2

## Quick start

```bash
cd madina-bazar

# Ensure backend/.env exists (copy from .env.example)
# Set at least:
#   JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
#   CLIENT_URL=http://localhost
#   API_URL=http://localhost

docker compose up -d --build
```

- **Website:** http://localhost  
- **API:** http://localhost/api  
- **MongoDB:** localhost:27017  

## Seed data (first time)

```bash
docker compose exec backend node utils/seed.js
docker compose exec backend node utils/seedCategories.js
docker compose exec backend node utils/seedDeliveryAreas.js
```

Default admin: `admin@madinabazar.com` / `Admin@123456`

## Useful commands

```bash
docker compose ps
docker compose logs -f backend
docker compose restart backend
docker compose down
docker compose down -v   # also delete DB volume
```

## Production notes

1. Change all secrets in `backend/.env`
2. Put a reverse proxy (Nginx/Caddy) or cloud load balancer in front for HTTPS
3. Or use the classic PM2 + host Nginx guide in `DEPLOY.md`
4. For `CLIENT_URL` / payment callbacks use your real HTTPS domain

## Rebuild after code change

```bash
docker compose up -d --build
```
