# frontend

풀필먼트 검수-포장 판단 시스템 웹 프론트. 명세 정본은 [`cj-ai-sw/docs`](https://github.com/cj-ai-sw/docs) 저장소다.

## 스택 (D-08 / docs 06 §1)

Next.js 16.3.1 (App Router) · React 19.2.8 · TypeScript 5 · Tailwind CSS 4 · shadcn/ui
· TanStack Query 5 · react-hook-form + zod · Node 24.19

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
```

백엔드는 `BACKEND_ORIGIN` 으로 프록시된다. `.env.example` 을 `.env.local` 로 복사해 쓴다.

| 실행 방식 | `BACKEND_ORIGIN` |
| --- | --- |
| 로컬 직접 실행 (`npm run dev`) | `http://127.0.0.1:8000` |
| docker compose | `http://backend:8000` (compose 가 주입) |

전체 스택(DB·백엔드·프론트) 기동은 docs 저장소의 `06-docker-setup.md` 를 따른다.
이 저장소만 컨테이너로 띄우려면 루트의 `Dockerfile` 을 쓴다.

## 구조

```
app/
  layout.tsx        루트 레이아웃 — 네비 + TanStack Query Provider + Toaster
  providers.tsx     QueryClient 설정 (4xx 는 재시도 안 함)
  page.tsx          화면 3개 링크
  inbound/          입고 등록   — P1
  packing/          출고 포장   — P2
  dashboard/        통합 대시보드 — P3
components/
  app-nav.tsx       상단 네비게이션
  common/           화면 공용 조각
  ui/               shadcn/ui (직접 수정 가능)
lib/
  api.ts            fetch 래퍼 — docs 02 §0 공통 에러 포맷 처리
  endpoints.ts      엔드포인트 정의 + TanStack Query 키. 02 의 번호와 1:1
  types.ts          API 계약 타입 — 02 v0.3 기준
  nav.ts            화면 3개 정의
```

## 규칙

- API 계약이 바뀌면 **docs 02 를 먼저 고치고** `lib/types.ts`·`lib/endpoints.ts` 를 맞춘다.
- API 호출은 반드시 `lib/endpoints.ts` 를 거친다. 컴포넌트에서 `fetch` 직접 호출 금지 —
  에러 포맷 처리가 `lib/api.ts` 한 곳에만 있다.
- 단위는 cm / kg (D-03). 필드명도 `widthCm` / `weightKg` 그대로 쓴다.
- 자기 도메인 화면 디렉토리만 수정한다. `components/ui/`·`lib/` 변경은 다른 담당과 공유되므로
  바꾸기 전에 알린다.

## 알려진 문제

### ⚠️ compose 로 띄우면 브라우저발 API 호출이 실패한다 (미수정)

`next.config.ts` 의 `rewrites()` 는 **빌드 시점에 평가되어** `.next/routes-manifest.json` 에 박힌다.
standalone 산출물에는 `next.config` 가 들어가지 않으므로 런타임에 다시 계산되지 않는다.

```
.next/routes-manifest.json → "destination": "http://127.0.0.1:8000/api/v1/:path*"
```

현재 `Dockerfile` 빌드 스테이지에는 `BACKEND_ORIGIN` 이 없어서 이미지에는 항상 기본값
`http://127.0.0.1:8000` 이 박힌다. 컨테이너 안에서 그 주소는 **프론트 컨테이너 자기 자신**이라,
docs 06 §3 compose 가 런타임 env 로 주는 `http://backend:8000` 은 무시된다.

- **증상**: 서버 컴포넌트 경로(`lib/api.ts` 가 런타임 `process.env` 를 읽음)는 정상 동작하는데
  브라우저발 `/api/v1/*` 만 연결 거부된다. docs 06 §8 표의 "프론트에서 API 호출이 404" 로 보인다.
- **영향 없는 경로**: docs 06 §7 의 "DB 만 Docker + `npm run dev`" 는 기본값이 맞아 정상 동작한다.
- **수정 후보**: ① `app/api/v1/[...path]/route.ts` 라우트 핸들러로 런타임 프록시,
  ② `Dockerfile` 빌드 스테이지에 `ARG`/`ENV BACKEND_ORIGIN` 추가 (compose 를 `build.args` 로 바꿔야 하므로 docs 06 §3 도 같이 수정).
- **상태**: 보류. 시연 준비는 `npm run dev` 경로로 진행 가능하므로 P3 인프라 Task 에서 다룬다.
  API 배선을 시작하기 전에 결론이 나야 한다.

## 검증

```bash
npx tsc --noEmit   # 타입
npm run lint       # ESLint
npm run build      # 프로덕션 빌드 (standalone 산출)
```

## 시연 서버에 띄우기 (팀원 전용)

화면은 EC2 에서 돌고 **비밀번호를 아는 사람만** 들어온다. 팀원이 각자 다른 망에서
접속하므로 IP 로는 거를 수 없어 `proxy.ts` 가 Basic 인증으로 전체 경로를 막는다
(`/api/v1/*` 포함 — 화면을 거치지 않고 API 만 부르는 것도 막힌다).

```bash
# EC2 에서
git clone https://github.com/cj-ai-sw/frontend.git ~/frontend && cd ~/frontend
cp .env.example .env
# .env 에 APP_PASSWORD 를 채운다. BACKEND_ORIGIN 은 기본값(host.docker.internal:8000)이면 된다.
sudo docker compose up -d --build
```

백엔드 호출은 `app/api/v1/[...path]/route.ts` 가 대신한다. 여기서 `API_KEY` 를
`X-Api-Key` 헤더로 붙이므로 **열쇠는 서버에만 있고 브라우저에는 내려가지 않는다**
(backend D-26). 화면 접근용 계정(`Authorization`)은 백엔드로 넘기지 않는다.

프론트 컨테이너는 백엔드 compose 가 만든 네트워크(`backend_default`)에 얹혀 `backend:8000` 으로
부른다. 그래서 **백엔드 포트를 인터넷에 열지 않아도** 화면이 동작한다. 백엔드가 먼저 떠 있어야
하고, 네트워크 이름이 다르면 `.env` 의 `BACKEND_NETWORK` 로 바꾼다.

접속은 `http://<서버주소>:3000` 이고 브라우저가 아이디·비밀번호를 묻는다. `.env` 의
`APP_USER` / `APP_PASSWORD` 와 맞아야 들어온다 — `APP_USER` 를 비워 두면 아이디는
검사하지 않는다.

`APP_PASSWORD` 를 비우면 게이트가 꺼진다 — 로컬 개발은 지금까지처럼 그대로 돌아간다.

> Basic 인증은 자격증명을 요청마다 보낸다. 시연 서버에 HTTPS 가 없으므로 같은 망을 엿볼 수
> 있는 사람에게는 비밀번호가 노출된다. 시연 전용 비밀번호를 쓰고 끝나면 버린다.

## 자동 배포 (Vercel)

`develop` 에 머지되면 `.github/workflows/deploy-vercel.yml` 이 프로덕션으로 올린다.

Vercel 의 Git 연동은 쓰지 않는다 — Hobby 플랜에서는 조직 소유 저장소를 연결할 수 없다.
대신 CLI 가 소스를 직접 올리며, 이 경로에는 그 제한이 없다.

필요한 저장소 시크릿 세 가지다.

| 시크릿 | 값 |
|---|---|
| `VERCEL_TOKEN` | vercel.com/account/tokens 에서 발급 |
| `VERCEL_ORG_ID` | `.vercel/project.json` 의 `orgId` |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` 의 `projectId` |

환경변수는 저장소에 복제하지 않는다. 워크플로가 `vercel pull` 로 Vercel 에서 받아 오므로,
값을 바꿀 때는 Vercel 쪽만 고치면 된다.
