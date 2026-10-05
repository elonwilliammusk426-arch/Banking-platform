# Build context is the backend/ directory itself, so this image builds
# identically whether it comes from Railway (Root Directory = backend),
# `docker compose`, or a plain `docker build backend/`.
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache libc6-compat python3 make g++
COPY package.json package-lock.json ./
# Do NOT set PRISMA_SCHEMA_ENGINE_BINARY here: it would apply to this install
# and suppress the real schema-engine download that `prisma migrate deploy`
# needs at runtime. scripts/generate.mjs already scopes that variable to the
# single `prisma generate` child process that needs it.
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev --omit=optional

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache libc6-compat
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/package.json ./package.json
USER node
EXPOSE 4000
# Apply any pending migrations, then boot the API.
CMD ["npm", "run", "release"]
