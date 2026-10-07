FROM node:20-alpine

WORKDIR /app

COPY ops/ryzen/marga-biz/package.json ops/ryzen/marga-biz/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY ops/ryzen/marga-biz/server.js ./server.js

ENV NODE_ENV=production
ENV NODE_PATH=/app/node_modules

USER node

EXPOSE 9400

CMD ["node", "/app/server.js"]
