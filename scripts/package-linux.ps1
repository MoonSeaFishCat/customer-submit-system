$ErrorActionPreference = "Stop"

npm run build

$pkg = "dist/customer-submit-system-linux"
$archive = "dist/customer-submit-system-linux.tar.gz"

if (Test-Path $pkg) {
  Remove-Item $pkg -Recurse -Force
}

if (Test-Path $archive) {
  Remove-Item $archive -Force
}

New-Item -ItemType Directory -Force $pkg | Out-Null

foreach ($item in @("app", "components", "lib", "scripts", "public")) {
  if (Test-Path $item) {
    Copy-Item $item -Destination $pkg -Recurse -Force
  }
}

foreach ($file in @("package.json", "package-lock.json", "next.config.mjs", "jsconfig.json", "postcss.config.js", "tailwind.config.js", ".env.example", "README.md")) {
  if (Test-Path $file) {
    Copy-Item $file -Destination $pkg -Force
  }
}

Copy-Item ".next" -Destination $pkg -Recurse -Force
New-Item -ItemType Directory -Force (Join-Path $pkg "data") | Out-Null

@'
# Linux 部署说明

## 1. 环境要求

- Linux 服务器
- Node.js 建议 22.x 或更高版本
- npm
- 如使用 MySQL，请准备 MySQL 数据库与账号
- 如使用 SQLite，请确保持久化挂载 data 目录

## 2. 解压部署包

```bash
tar -xzf customer-submit-system-linux.tar.gz
cd customer-submit-system-linux
```

## 3. 安装生产依赖

```bash
npm ci --omit=dev
```

## 4. 配置环境变量

```bash
cp .env.example .env
vi .env
```

至少建议修改：

```env
ADMIN_SECRET=请改成强密码
API_SECRET=请改成强密码
COOKIE_SECURE=false
DB_CLIENT=sqlite
SQLITE_PATH=data/customer-submit.sqlite
```

说明：

- HTTP、内网或未配置 HTTPS 的部署请保持 `COOKIE_SECURE=false`
- 确认全站 HTTPS 后，可设置 `COOKIE_SECURE=true`

MySQL 示例：

```env
DB_CLIENT=mysql
MYSQL_URL=mysql://user:password@127.0.0.1:3306/customer_submit_system
```

## 5. 初始化数据库

```bash
npm run init-db
```

## 6. 启动服务

```bash
npm run start
```

默认监听 3000 端口。可使用：

```bash
PORT=3000 npm run start
```

## 7. systemd 示例

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

## 8. Nginx 反向代理示例

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
'@ | Set-Content -Path (Join-Path $pkg "DEPLOY_LINUX.md") -Encoding UTF8

tar -czf $archive -C dist customer-submit-system-linux

Get-Item $archive | Select-Object FullName,Length
