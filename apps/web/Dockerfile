# Production image of the web app.
#
# Build it from the repository root (the npm workspace root), for example
#   docker build -f apps/web/Dockerfile -t campus-ride-pooling .
# docker-compose.yml at the root does this for you.

# ---- Dependencies, including the build tools ----
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @ridepool/web --include-workspace-root

# ---- Production build ----
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY apps/web apps/web
RUN npm run build --workspace @ridepool/web

# ---- Runtime: production dependencies and the build output only ----
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace @ridepool/web --include-workspace-root \
    && npm cache clean --force
COPY --from=build --chown=node:node /app/apps/web/.next apps/web/.next
COPY --chown=node:node apps/web/next.config.ts apps/web/
COPY --chown=node:node apps/web/db apps/web/db
COPY --chown=node:node apps/web/scripts apps/web/scripts

USER node
EXPOSE 3000

# Applies db/schema.sql (idempotent), then serves the app.
CMD ["sh", "-c", "npm run db:migrate --workspace @ridepool/web && npm run start --workspace @ridepool/web"]
