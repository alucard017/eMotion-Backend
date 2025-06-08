# Stage 1: Build stage
FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json tsconfig*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Runtime stage
FROM node:22-slim

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 8002

CMD ["node", "dist/server.js"]
