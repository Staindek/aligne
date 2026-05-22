# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# NestJS backend — multi-stage build
#
# 3 stages: deps → builder → runner
#   - deps:    instala TODAS las dependencias (incluyendo dev). Cache por package-lock.
#   - builder: compila TypeScript → dist/. Necesita devDependencies (nest, typescript).
#   - runner:  imagen final. SOLO deps de producción + dist + usuario no-root.
#
# Resultado: imagen final ~150 MB en lugar de ~1 GB que sería con todo junto.
# ─────────────────────────────────────────────────────────────────────────────

# ============================================================================
# Stage 1 — deps
# Instala todas las dependencias. Aislado para maximizar layer cache:
# si solo cambia el código fuente, este stage no se re-ejecuta.
# ============================================================================
FROM node:20-alpine AS deps
WORKDIR /app

# Copiamos solo los manifests primero. Layer caching:
# si package*.json no cambia, npm ci viene de cache.
COPY package.json package-lock.json ./

# npm ci > npm install para builds reproducibles:
#   - falla si package-lock.json no está sincronizado
#   - borra node_modules antes de instalar
#   - no actualiza package-lock.json
RUN npm ci

# ============================================================================
# Stage 2 — builder
# Compila TypeScript a dist/. Reutiliza node_modules del stage anterior.
# ============================================================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ============================================================================
# Stage 3 — runner (imagen final)
# Solo lleva: deps de producción + dist + usuario no-root.
# Nada de TypeScript, ni devDependencies, ni código fuente .ts.
# ============================================================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Usuario no-root: si el container es comprometido, el atacante
# no es root dentro del container. Defense-in-depth.
RUN addgroup -S nestjs && adduser -S nestjs -G nestjs

# Solo deps de producción (--omit=dev = sin devDependencies)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Código compilado del stage builder
COPY --from=builder --chown=nestjs:nestjs /app/dist ./dist

USER nestjs

EXPOSE 3000

CMD ["node", "dist/main"]
