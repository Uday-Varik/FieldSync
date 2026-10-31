# FieldSync API image (NestJS + Prisma). The web app deploys to Vercel;
# this image is the API only. Build context is the repo root.
FROM node:20-bookworm-slim AS build
WORKDIR /app
# Manifests first for layer caching. apps/web's manifest is copied so
# npm workspace resolution succeeds; its source is not copied.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci
COPY apps/api apps/api
COPY packages/shared packages/shared
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build --workspace=fieldsync-api

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/packages/shared packages/shared
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
