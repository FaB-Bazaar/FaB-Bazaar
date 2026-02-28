# Stage 1: Install all dependencies (including native module compilation)
FROM node:20-alpine@sha256:09e2b3d9726018aecf269bd35325f46bf75046a643a66d28360ec71132750ec8 AS deps
RUN apk add --no-cache libc6-compat python3 make g++ krb5-dev
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Build the application
FROM node:20-alpine@sha256:09e2b3d9726018aecf269bd35325f46bf75046a643a66d28360ec71132750ec8 AS builder
RUN apk add --no-cache libc6-compat python3 make g++ krb5-dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Use .env.example as a build-time stub to satisfy Next.js module-level env checks.
# Real secrets are never baked into the image — they are injected at runtime
# via env_file and environment in docker-compose.yml.
COPY .env.example .env.local

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max_old_space_size=1536"

RUN npm run build

# Stage 3: Lean production runtime using Next.js standalone output
FROM node:20-alpine@sha256:09e2b3d9726018aecf269bd35325f46bf75046a643a66d28360ec71132750ec8 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# krb5-libs needed at runtime for the kerberos native module
RUN apk add --no-cache krb5-libs && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
