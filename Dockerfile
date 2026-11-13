# Stage 1: Install all dependencies (including native module compilation)
FROM node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS deps
RUN apk add --no-cache libc6-compat python3 make g++ krb5-dev
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Build the application
FROM node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS builder
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

ARG NEXT_PUBLIC_APP_URL=https://fabbazaar.app
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# NEXT_PUBLIC_GA_ID must be a build-arg, not just a runtime env: Next.js inlines
# `process.env.NEXT_PUBLIC_*` into client bundles at compile time, so the
# runtime `env_file: .env` mount is too late. Default is the placeholder so
# local dev builds without a real GA property still succeed; CI/prod pass the
# real ID via docker-compose's args (which reads from .env).
ARG NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID

RUN --mount=type=cache,target=/app/.next/cache \
    NODE_OPTIONS="--max_old_space_size=1536" npm run build

# Stage 3: Lean production runtime using Next.js standalone output
FROM node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS runner
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
