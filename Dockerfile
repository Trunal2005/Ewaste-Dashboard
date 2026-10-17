# Multi-stage production Dockerfile for EWEM Dashboard
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/tsconfig*.json ./
COPY --from=builder /app/scripts ./scripts

# Persistent storage directories (mount persistent volume here in production)
RUN mkdir -p /app/data /app/uploads

EXPOSE 3001

CMD ["npm", "start"]
