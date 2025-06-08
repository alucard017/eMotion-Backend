# Stage 1: Build
FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json tsconfig*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Run
FROM node:22-slim

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 8080

CMD ["node", "dist/server.js"]
