# CI/CD — Madina Bazar

## Workflows

| File | Trigger | What it does |
|------|---------|--------------|
| `.github/workflows/ci.yml` | push / PR | Backend syntax check, frontend build, Docker build |
| `.github/workflows/cd-vps.yml` | push to main + manual | SSH deploy to VPS (PM2 + frontend build) |
| `.github/workflows/cd-docker-hub.yml` | version tags `v*` + manual | Push images to Docker Hub |

---

## 1. CI (automatic)

No secrets required. On every push/PR to `main` / `master` / `develop`:

- Backend: `node --check` on source files  
- Frontend: `npm run build`  
- Docker images build (push disabled)

---

## 2. CD → VPS (SSH)

### GitHub Secrets

Repo → **Settings → Secrets and variables → Actions**

| Secret | Example |
|--------|---------|
| `VPS_HOST` | `12.34.56.78` or `madinabazar.com` |
| `VPS_USER` | `ubuntu` |
| `VPS_SSH_KEY` | Private key (`-----BEGIN OPENSSH PRIVATE KEY-----` ...) |
| `VPS_DEPLOY_PATH` | `/var/www/madina-bazar` (optional) |

### Server one-time setup

```bash
# Deploy user can git pull + pm2 + npm
cd /var/www/madina-bazar
git remote -v   # must be able to fetch your repo

# SSH public key of the deploy key → ~/.ssh/authorized_keys
```

### Flow

1. Push to `main`  
2. Action SSHs into VPS  
3. `git reset --hard origin/main`  
4. `npm install` + `pm2 restart`  
5. Frontend `npm run build`

Manual run: **Actions → CD — Deploy to VPS → Run workflow**

---

## 3. CD → Docker Hub

### Secrets

| Secret | Description |
|--------|-------------|
| `DOCKERHUB_USERNAME` | Docker Hub user |
| `DOCKERHUB_TOKEN` | Access token (not password) |

### Release

```bash
git tag v1.0.0
git push origin v1.0.0
```

Images:

- `youruser/madina-bazar-api:v1.0.0` (+ `latest`)  
- `youruser/madina-bazar-web:v1.0.0` (+ `latest`)

On server:

```bash
docker pull youruser/madina-bazar-api:latest
docker pull youruser/madina-bazar-web:latest
docker compose up -d
```

---

## Branch strategy (suggested)

```
develop  → feature work, CI only
main     → production, CI + CD VPS
v* tags  → Docker Hub release
```

---

## Security notes

- Never commit `.env`  
- Use GitHub **Environments** with protection rules for production  
- Prefer deploy key (read-only repo + limited server user)  
- Rotate SSH keys and Docker tokens periodically  
