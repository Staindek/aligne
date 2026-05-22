# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# Next.js frontend — multi-stage build
#
# 3 stages: deps → builder → runner
#
# Diferencia clave con el backend: el "runner" no instala npm packages.
# Usa el output `standalone` de Next, que ya incluye un node_modules mínimo
# con SOLO los módulos efectivamente importados desde el código. Es mucho
# más eficiente que `npm ci --omit=dev`.
# ─────────────────────────────────────────────────────────────────────────────

# ============================================================================
# Stage 1 — deps
# ============================================================================
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ============================================================================
# Stage 2 — builder
# `next build` con output:'standalone' produce:
#   .next/standalone/   ← app + node_modules tree-shaken + server.js
#   .next/static/       ← assets estáticos (JS, CSS) que sirve el server
#   public/             ← archivos públicos sin procesar (imágenes, etc.)
#
# IMPORTANTE: NEXT_PUBLIC_* env vars se hornean en build, no en runtime.
# Si necesitás cambiar la URL del API entre dev/staging/prod, pasala como
# build arg desde docker-compose (ver compose).
# ============================================================================
FROM node:20-alpine AS builder
WORKDIR /app

# Build arg: URL del API que verá el browser. Se mete en el bundle JS.
ARG NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Telemetría de Next: opt-out (no manda métricas de uso a Vercel)
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ============================================================================
# Stage 3 — runner (imagen final)
# Solo standalone + assets estáticos + public/. Sin npm, sin node_modules
# manuales, sin código fuente .ts.
# ============================================================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Usuario no-root
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

# Output standalone trae todo el árbol de la app + node_modules minimal + server.js
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
# Los archivos estáticos NO están en standalone, hay que copiarlos aparte
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/public ./public

USER nextjs

EXPOSE 3001

# El server.js standalone usa estas dos vars para saber dónde escuchar.
# HOSTNAME=0.0.0.0 es CRÍTICO: por default Next standalone escucha solo en
# localhost del container, lo que lo hace inalcanzable desde afuera.
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
