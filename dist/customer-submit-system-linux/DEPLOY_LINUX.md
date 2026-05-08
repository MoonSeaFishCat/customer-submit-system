# Linux 閮ㄧ讲璇存槑

## 1. 鐜瑕佹眰

- Linux 鏈嶅姟鍣?
- Node.js 寤鸿 22.x 鎴栨洿楂樼増鏈?
- npm
- 濡備娇鐢?MySQL锛岃鍑嗗 MySQL 鏁版嵁搴撲笌璐﹀彿
- 濡備娇鐢?SQLite锛岃纭繚鎸佷箙鍖栨寕杞?data 鐩綍

## 2. 瑙ｅ帇閮ㄧ讲鍖?

```bash
tar -xzf customer-submit-system-linux.tar.gz
cd customer-submit-system-linux
```

## 3. 瀹夎鐢熶骇渚濊禆

```bash
npm ci --omit=dev
```

## 4. 閰嶇疆鐜鍙橀噺

```bash
cp .env.example .env
vi .env
```

鑷冲皯寤鸿淇敼锛?

```env
ADMIN_SECRET=璇锋敼鎴愬己瀵嗙爜
API_SECRET=璇锋敼鎴愬己瀵嗙爜
DB_CLIENT=sqlite
SQLITE_PATH=data/customer-submit.sqlite
```

MySQL 绀轰緥锛?

```env
DB_CLIENT=mysql
MYSQL_URL=mysql://user:password@127.0.0.1:3306/customer_submit_system
```

## 5. 鍒濆鍖栨暟鎹簱

```bash
npm run init-db
```

## 6. 鍚姩鏈嶅姟

```bash
npm run start
```

榛樿鐩戝惉 3000 绔彛銆傚彲浣跨敤锛?

```bash
PORT=3000 npm run start
```

## 7. systemd 绀轰緥

```ini
[Unit]
Description=Customer Submit System
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/customer-submit-system-linux
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## 8. Nginx 鍙嶅悜浠ｇ悊绀轰緥

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
