FROM node:24.19-alpine AS deps
WORKDIR /app
# 락파일 기준으로 정확히 재현되도록 npm ci 를 쓴다 (npm install 아님)
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24.19-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24.19-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
