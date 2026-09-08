FROM node:20-alpine

WORKDIR /app

# Deps de build para sharp
RUN apk add --no-cache python3 make g++ vips-dev

COPY package*.json ./
RUN npm ci

COPY . .

# Container fica idle com health-check HTTP. Scheduled tasks do Coolify
# disparam comandos via `docker exec` (ex: npm run modo:tavily -- --capital X --push --live).
EXPOSE 3000
CMD ["node", "-e", "require('http').createServer((_,r)=>{r.writeHead(200);r.end('ok');}).listen(3000)"]
