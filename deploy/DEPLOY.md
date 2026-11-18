# Madina Bazar — VPS Deployment Guide

Domain: **www.madinabazar.com** (example)  
Stack: Ubuntu 22.04+ · Node.js 20 · MongoDB · Nginx · PM2 · Certbot SSL

---

## 1. Server prepare

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential nginx

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2
sudo npm install -g pm2

# MongoDB (or use MongoDB Atlas)
# Option A — local:
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl enable --now mongod

# Option B — Atlas: set MONGODB_URI in .env to Atlas connection string
```

---

## 2. Clone / upload project

```bash
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
cd /var/www
# git clone <your-repo> madina-bazar
# OR upload via scp/rsync
cd madina-bazar
```

---

## 3. Backend setup

```bash
cd /var/www/madina-bazar/backend
npm install --production

# Install optional packages if used
npm install nodemailer cloudinary --save

cp .env.example .env   # or edit existing .env
nano .env
```

### Production `.env` checklist

```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/madina-bazar
# or Atlas URI

JWT_ACCESS_SECRET=CHANGE_TO_LONG_RANDOM_STRING
JWT_REFRESH_SECRET=CHANGE_TO_ANOTHER_LONG_RANDOM
JWT_ACCESS_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d

CLIENT_URL=https://www.madinabazar.com
API_URL=https://www.madinabazar.com

# Payment / Barikoi / SMTP / SMS — fill as needed
```

```bash
# Seed admin + sample data (once)
npm run seed
npm run seed:categories
npm run seed:delivery

# Start with PM2
mkdir -p logs
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup   # follow the command it prints
```

Check: `pm2 status` · `curl http://127.0.0.1:5000/api/settings`

---

## 4. Frontend build

```bash
cd /var/www/madina-bazar/frontend
npm install

# Production API URL (same domain via Nginx proxy)
echo "VITE_API_URL=https://www.madinabazar.com/api" > .env.production

npm run build
# Output: frontend/dist
```

---

## 5. Nginx

```bash
sudo cp /var/www/madina-bazar/deploy/nginx-madinabazar.conf /etc/nginx/sites-available/madinabazar
# Edit server_name to your domain
sudo nano /etc/nginx/sites-available/madinabazar

sudo ln -sf /etc/nginx/sites-available/madinabazar /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Point DNS **A records**:
- `madinabazar.com` → VPS IP  
- `www.madinabazar.com` → VPS IP  

---

## 6. SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d madinabazar.com -d www.madinabazar.com
# Auto-renew is enabled by default
sudo certbot renew --dry-run
```

---

## 7. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## 8. Updates (later deploys)

```bash
cd /var/www/madina-bazar
git pull   # or upload new files

cd backend && npm install --production
pm2 restart madina-bazar-api

cd ../frontend && npm install && npm run build
# Nginx serves dist/ — no restart needed for static files
```

---

## 9. Useful commands

```bash
pm2 logs madina-bazar-api
pm2 monit
sudo tail -f /var/log/nginx/error.log
```

---

## 10. Payment callbacks (production)

Set gateway callback / success URLs to:

- bKash: `https://www.madinabazar.com/api/payments/bkash/callback`
- Nagad: `https://www.madinabazar.com/api/payments/nagad/callback`
- SSLCommerz: `https://www.madinabazar.com/api/payments/sslcommerz/success` (etc.)

And in `.env`:
```env
CLIENT_URL=https://www.madinabazar.com
API_URL=https://www.madinabazar.com
```

---

## Default Super Admin (change after first login)

- Email: `admin@madinabazar.com`
- Password: `Admin@123456`

**Change password immediately in production.**
