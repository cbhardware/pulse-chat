FROM node:20-bookworm-slim

WORKDIR /app

COPY backend/package*.json ./
COPY backend/prisma ./prisma

RUN npm ci
RUN npm run db:generate

COPY backend/tsconfig.json ./tsconfig.json
COPY backend/src ./src
COPY backend/scripts ./scripts
COPY backend/vitest.config.ts ./vitest.config.ts
COPY backend/tests ./tests

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "run", "start"]
