FROM node:20-alpine AS builder

WORKDIR /app

COPY package-lock.json ./
COPY package.json ./

RUN npm ci

COPY . .

ARG PUBLIC_DEFAULT_API_URL=http://localhost:1300
ENV PUBLIC_DEFAULT_API_URL=${PUBLIC_DEFAULT_API_URL}

RUN npm run build:docker

FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache tini

COPY package.json ./
COPY package-lock.json ./

RUN npm ci --omit=dev

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.svelte-kit ./.svelte-kit

ENV NODE_ENV=production
ENV PORT=1400
EXPOSE 1400

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "build/index.js"]