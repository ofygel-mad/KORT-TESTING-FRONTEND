# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# VITE_API_BASE_URL — переопределяется в Railway через build variable.
# По умолчанию /api/v1 → nginx-proxy (для docker-compose).
# Для Railway set: VITE_API_BASE_URL=https://backend.railway.app/api/v1
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY . .
RUN pnpm run build

# ── Stage 2: Serve ───────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

RUN apk add --no-cache gettext curl

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/start-nginx.sh /usr/local/bin/start-nginx.sh
COPY --from=builder /app/dist /usr/share/nginx/html

RUN chmod +x /usr/local/bin/start-nginx.sh

ENV PORT=80
ENV BACKEND_URL=http://127.0.0.1:8000

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:80/ || exit 1

CMD sh -c "/usr/local/bin/start-nginx.sh"
