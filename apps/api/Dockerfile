FROM node:22-alpine AS build
WORKDIR /app
ENV PRISMA_SCHEMA_ENGINE_BINARY=/usr/local/bin/node
RUN apk add --no-cache libc6-compat python3 make g++
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/database/package.json packages/database/package.json
RUN npm ci
COPY apps/api apps/api
COPY packages/database packages/database
RUN npm run db:generate && npm run build -w @haven/database && npm run build -w @haven/api
RUN npm prune --omit=dev --omit=optional

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache libc6-compat
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/packages/database ./packages/database
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
