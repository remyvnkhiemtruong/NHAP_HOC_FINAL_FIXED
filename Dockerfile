FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV REDIS_URL=redis://127.0.0.1:6379
ENV STORAGE_ROOT=/tmp/admission-build
ENV RATE_LIMIT_BACKEND=redis
ENV TRUSTED_PROXY_HOPS=1
COPY package.json package-lock.json ./
COPY vendor ./vendor
COPY prisma ./prisma
COPY scripts ./scripts
COPY prisma.config.ts tsconfig.json next.config.ts postcss.config.mjs ./
RUN npm ci
COPY public ./public
COPY src ./src
RUN JWT_SECRET=build-only-secret-build-only-secret-1234 \
    ENCRYPTION_KEY=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff \
    npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --chown=node:node --from=build /app/package.json /app/package-lock.json ./
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/.next ./.next
COPY --chown=node:node --from=build /app/public ./public
COPY --chown=node:node --from=build /app/src ./src
COPY --chown=node:node --from=build /app/prisma ./prisma
COPY --chown=node:node --from=build /app/scripts ./scripts
COPY --chown=node:node --from=build /app/prisma.config.ts /app/tsconfig.json /app/next.config.ts ./
RUN mkdir -p /data/private && chown node:node /data/private
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
