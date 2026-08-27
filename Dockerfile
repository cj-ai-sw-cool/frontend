FROM node:24.19-alpine AS deps
WORKDIR /app
# 락파일 기준으로 정확히 재현되도록 npm ci 를 쓴다 (npm install 아님)
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24.19-alpine AS build
WORKDIR /app
# next.config.ts 의 rewrites 는 빌드 때 한 번 계산돼 routes-manifest.json 에 박힌다.
# 그래서 런타임 환경변수로는 프록시 대상이 바뀌지 않는다 — 빌드 인자로 받아야 한다.
# 서버 컴포넌트가 직접 부르는 경로(lib/api.ts)는 런타임 값을 읽으므로 양쪽에 같은 값을 준다.
ARG BACKEND_ORIGIN=http://127.0.0.1:8000
ENV BACKEND_ORIGIN=$BACKEND_ORIGIN
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
