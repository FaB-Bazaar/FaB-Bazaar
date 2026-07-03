# fab-table — webcam play companion service.
# Tiny by design: no framework, no build step, node_modules is one package.
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js ./
COPY lib ./lib
COPY public ./public

ARG BUILD_SHA=dev
ENV BUILD_SHA=$BUILD_SHA

# Room-snapshot dir. Owned by `node` so a fresh named volume mounted here
# inherits that ownership (Docker seeds an empty volume from the image dir),
# letting the unprivileged process write the graceful-shutdown snapshot.
RUN mkdir -p /data && chown node:node /data

USER node
EXPOSE 8787
# Heap capped below the container's mem_limit so V8 aborts cleanly (verbose
# stack in logs) before the kernel OOM-kills us.
CMD ["node", "--max-old-space-size=192", "server.js"]
