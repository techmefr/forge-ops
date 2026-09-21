FROM node:24-bookworm-slim AS build
WORKDIR /forge
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:back

FROM node:24-bookworm-slim
ENV NODE_ENV=production
ENV FORGE_ROLE=server
ENV FORGE_HOST=0.0.0.0
ENV FORGE_PORT=4311
ENV FORGE_DB_PATH=/data/forge.db
WORKDIR /forge
COPY --from=build /forge/node_modules ./node_modules
COPY --from=build /forge/dist ./dist
COPY --from=build /forge/db ./dist/db
COPY --from=build /forge/package.json ./package.json
RUN mkdir -p /data && chown node:node /data
VOLUME /data
EXPOSE 4311
HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4311/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
USER node
CMD ["node", "dist/backend/src/forge.js"]
