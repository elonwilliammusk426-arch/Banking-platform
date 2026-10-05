# Build context is the frontend/ directory itself, so this image builds
# identically whether it comes from Railway (Root Directory = frontend),
# `docker compose`, or a plain `docker build frontend/`.
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# next.config.ts sets output: 'standalone', so the runner only needs the
# self-contained server bundle plus static assets.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
