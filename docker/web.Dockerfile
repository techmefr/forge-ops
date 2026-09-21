FROM node:24-bookworm-slim AS build
WORKDIR /forge
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:web

FROM nginx:1.27-alpine
COPY --from=build /forge/dist/web /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/web-entrypoint.sh /docker-entrypoint.d/10-forge-addresses.sh
RUN chmod +x /docker-entrypoint.d/10-forge-addresses.sh \
 && touch /etc/nginx/forge-api-proxy.conf
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1/config.js || exit 1
