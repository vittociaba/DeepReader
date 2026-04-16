FROM node:20-alpine

RUN apk add --no-cache su-exec \
 && addgroup -S deepreader && adduser -S -G deepreader deepreader

WORKDIR /app

COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

RUN npm ci --workspaces

COPY . .

RUN npm run build

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 7070

# Entrypoint runs as root so it can fix /data ownership, then drops to deepreader
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server/index.js"]
