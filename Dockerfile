FROM node:20-alpine

WORKDIR /app

# Create data directories
RUN mkdir -p /data/library /data/vault

COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

RUN npm ci --workspaces

COPY . .

RUN npm run build

ENV NODE_ENV=production
ENV DB_PATH=/data/deepreader.db
ENV LIBRARY_PATH=/data/library

EXPOSE 7070

CMD ["node", "server/index.js"]
