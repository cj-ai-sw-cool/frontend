# frontend

3PL 풀필먼트 WMS 웹 프론트. 명세 정본은 backend 저장소의 `docs/02-system/02-data-model.md` 이고, 문서 지도는 `docs/README.md` 에 있다. API 계약이 바뀌면 정본을 먼저 고치고 `lib/types.ts`·`lib/endpoints.ts` 를 맞춘다.

## 스택

Next.js 16.3.1 (App Router) · React 19.2.8 · TypeScript 5 · Tailwind CSS 4 · shadcn/ui
· TanStack Query 5 · react-hook-form + zod · three.js 0.185 (3D) · Node 24.19

## 실행

```bash
npm install
PORT=3100 npm run dev        # http://localhost:3100
```

개발 서버는 3100을 쓴다 — 3000은 다른 프로젝트가 점유한다. 백엔드 호출은 `BACKEND_ORIGIN` 으로 넘어가고, `.env.example` 을 `.env.local` 로 복사해 쓴다.

| 실행 방식 | `BACKEND_ORIGIN` |
| --- | --- |
| 로컬 직접 실행 (`npm run dev`) | `http://127.0.0.1:8000` |
| docker compose | `http://backend:8000` (compose 가 주입) |

## 화면

화면은 넷이고, 앞의 셋은 센터 축 아래에 있다. `/inbound`·`/packing`·`/analytics` 로 들어오면 `/center/C1/…` 로 리다이렉트한다 (정본 §12.8). 센터 코드는 `useCenter()`(`lib/center.ts`)가 경로의 `[code]` 세그먼트에서 직접 읽으므로 prop 으로 내려보내지 않는다.

| 경로 | 화면 | 내용 |
| --- | --- | --- |
| `/center/{code}/inbound` | 입고 | ASN 검수, 치수 측정, 수량 입고 |
| `/center/{code}/packing` | 출고 포장 | 토트 스캔, 낱개 대조, 박스 추천, 파손 신고, 포장완료 |
| `/center/{code}/analytics` | 분석 | 상단 탭 3개 — 개요·슬로팅·시뮬레이션 |
| `/hub` | 다창고 허브 | 탭 6개 — 주문·이동·글로벌 ATP·센터·관제·화주 |

분석 화면의 탭 셋은 이렇게 나뉜다.

| 탭 | 내용 | 정본 |
| --- | --- | --- |
| 개요 | 3D·2D 창고, 입출고 흐름, 월간, 규격별 재고, 마스터·재고 오버레이, 실사, 불변식 배지 | §11.5·§17.3 |
| 슬로팅 | 매개변수 편집, 전후 비교 막대, 등급 분포, 2D 히트맵·골든존 테두리, 제안 표·선택 적용·자동 처리 | §15.9 |
| 시뮬레이션 | 시나리오 목록·생성·실행·정지·진행 띠, 리드타임 9구간 막대, 시간대별 유입 대 출고, 자원 점유, 병목 카드, 실행·묶음 비교 | §16.6·§17.8 |

허브 탭 여섯은 주문 라우팅 결과, 센터 간 이동 오더, 글로벌 ATP, 센터 요약, 실시간 관제, 화주 키·웹훅 주소·발송 이력을 각각 맡는다 (정본 §12.8·§13.5·§14.8). `/hub` 는 센터 축 밖이라 `[code]` 세그먼트가 없고, 탭마다 센터를 필터 값으로 받는다.

## 구조

```
app/
  layout.tsx        루트 레이아웃 — 네비 + TanStack Query Provider + Toaster
  providers.tsx     QueryClient 설정 (4xx 는 재시도 안 함)
  page.tsx          화면 4개 링크
  api/v1/[...path]/ 백엔드 프록시 라우트 핸들러
  center/[code]/    센터 축 경로 — inbound·packing·analytics 의 진입점
  inbound/          입고 등록      — P1 (Windows 98 스킨). 화면 본체는 여기 있다
  packing/          출고 포장      — P2 (Windows 98 스킨)
  analytics/        분석           — P3, 3D·2D 창고와 슬로팅·시뮬레이션 탭
  hub/              다창고 허브    — Stage 11D 이후 탭 6개
```

`inbound/`·`packing/`·`analytics/`·`hub/` 는 **코드를 공유하지 않는다** — 화면마다 아래 하위 디렉터리를 각자 한 벌씩 갖는다(win98 스킨 화면의 공통 규칙).

```
<route>/
  layout.tsx        그 화면의 셸(데스크톱·창 크롬·좌측 네비·센터 선택)
  page.tsx          컨테이너 — 데이터 훅과 컴포넌트를 잇고 화면 상태를 든다
  _components/      그리기 전용 컴포넌트(win98-ui.tsx 의 공용 조각 포함). fetch 없음
  _data/            TanStack Query 훅 — 컴포넌트에서 fetch 직접 호출 금지
  _styles/          win98.module.css 등 화면 전용 스타일
  _mock/            (inbound·packing) 개발용 목업 데이터
```

```
components/
  app-nav.tsx       상단 네비게이션
  common/           화면 공용 조각
  ui/               shadcn/ui (직접 수정 가능)
lib/
  api.ts            fetch 래퍼 — 공통 에러 포맷 처리
  endpoints.ts      엔드포인트 정의 + TanStack Query 키. 정본 API 절과 1:1
  types.ts          API 계약 타입 — 정본 기준
  center.ts         센터 컨텍스트 — 경로의 code, 셸 센터 선택 목록
  nav.ts            화면 4개 정의
  events-stream.ts  SSE 연결 — EventSource 를 여는 유일한 파일
  events-time.ts    이벤트 시각 계산
  use-events.ts     관제 이벤트 훅 — 스트림 상태·점등·마커 입력
  use-invariant.ts  불변식 배지·이력 훅
  invariant-format.ts  불변식 응답 표시 형식
  win98-toast.ts    win98 스킨 토스트
  utils.ts          클래스 병합 등 공용 유틸
  mocks/            백엔드가 아직 없을 때 쓰는 표본 (아래 "목업 규칙")
```

3D·2D 창고는 `app/analytics/_components/layout/` 에 나눠 두었다 — 카메라·조명(`layout-scene.tsx`), 방·베이 메시(`area-mesh.ts`·`bay-mesh.ts`), 좌표 변환(`layout-geometry.ts`), 베이 상세(`bay-detail.tsx`), 작업자 마커·경로(`worker-markers.ts`·`worker-path.ts`), 점등(`bay-pulse.ts`).

## 백엔드 프록시

브라우저가 부르는 `/api/v1/*` 는 `app/api/v1/[...path]/route.ts` 가 백엔드로 넘긴다. `next.config.ts` 의 `rewrites` 를 쓰지 않는 이유는 두 가지다 — 요청 헤더를 붙일 수 없어 백엔드 키를 실을 자리가 없고, `rewrites` 는 빌드 때 계산돼 산출물에 박히므로 배포 환경마다 다시 빌드해야 한다. 라우트 핸들러는 런타임에 `process.env.BACKEND_ORIGIN` 을 읽고 `API_KEY` 를 `X-Api-Key` 헤더로 붙인다. 키는 서버에만 있고 브라우저에는 내려가지 않는다.

이 라우트는 `dynamic = "force-dynamic"` 이다. 정적 최적화 후보로 잡히면 SSE 응답이 끝까지 버퍼링된 뒤에야 브라우저로 간다 — 라이브 검증에서 백엔드는 즉시 스트리밍하는데 이 라우트를 거치면 6초가 넘도록 0바이트가 나온 결함이 있었다.

## 실시간 관제와 SSE

`EventSource` 는 `lib/events-stream.ts` 한 곳에서만 연다. `GET /events/stream?center=&from=` 에 붙고, 이벤트 `id` 가 백엔드 순번(`seq`)이라 브라우저가 `Last-Event-ID` 로 자동 재개한다 (정본 §13.3·§13.6).

서버는 SSE 프레임에 `event: {type}` 이름을 붙여 보낸다. 브라우저 `EventSource` 는 이름 붙은 프레임을 `onmessage` 로 받지 못하므로, `WMS_EVENT_TYPES` 카탈로그 전체에 `addEventListener` 를 건다. 연결이 끊기면 지수 백오프(1초에서 시작해 30초 상한)로 재연결하고, 최초 연결이 연달아 세 번 실패하면 `lib/mocks/events.ts` 표본 스트림으로 넘어간 뒤에도 재시도를 계속해 백엔드가 뜨면 라이브로 돌아온다.

3D 관제는 `bayId` 가 있는 모든 이벤트에 반응한다 — 칸을 점등하고 작업자 마커를 통로 그래프 위로 보간해 옮긴다. `bayId` 가 없는 이벤트(토트·슬롯·입고장)는 마커를 그 자리에 둔다.

## 규칙

- API 호출은 반드시 `@/lib/endpoints` 를 거친다. 컴포넌트에서 `fetch` 직접 호출 금지 — 에러 포맷 처리가 `lib/api.ts` 한 곳에만 있다. SSE 는 `lib/events-stream.ts` 한 곳.
- API 계약이 바뀌면 backend `docs/` 의 정본을 먼저 고치고 `lib/types.ts`·`lib/endpoints.ts` 를 맞춘다.
- 파일 300줄 상한. 넘으면 컴포넌트를 나눈다.
- inline style 과 하드코딩 색 금지. Dialog 는 `z-70`, Select 는 `z-80`. 뮤테이션 훅은 `DialogContent` 안에 둔다.
- 단위는 cm / kg. 필드명도 `widthCm` / `weightKg` 그대로 쓴다.
- 자기 도메인 화면 디렉터리만 수정한다. `components/ui/`·`lib/` 변경은 다른 담당과 공유되므로 바꾸기 전에 알린다.

### 목업 규칙

`lib/mocks/` 는 백엔드 엔드포인트가 아직 없거나 재시드 중일 때만 화면을 채우는 표본이다. 훅이 실제 호출에 실패했을 때만 표본으로 대신 그리고, 성공하면 라이브 값이 이긴다. 표본 값은 난수가 아니라 매개변수로 결정하는 식이라 같은 조건에서 같은 그림이 나온다.

| 파일 | 대신하는 응답 |
| --- | --- |
| `layout.ts` | `GET /layout` · `GET /bays/{id}/bins` |
| `events.ts` | `GET /events/stream` |
| `hub.ts` | 허브 센터·주문·이동·ATP |
| `webhooks.ts` | 화주 키·웹훅 주소·발송 이력 |
| `slotting.ts` | 회전율·히트맵·골든존·제안·비교 |
| `simulation.ts` · `simulation-compare.ts` · `simulation-metrics.ts` | 시나리오·실행·리드타임·타임라인·병목·비교 |
| `invariant.ts` | 불변식 검사·이력 |

## 검증

```bash
npx tsc --noEmit   # 타입
npm run lint       # ESLint
npm run build      # 프로덕션 빌드 (standalone 산출)
```

## 시연 서버에 띄우기

화면은 EC2 에서 돌고 비밀번호를 아는 사람만 들어온다. 팀원이 각자 다른 망에서 접속하므로 IP 로는 거를 수 없어 `proxy.ts` 가 Basic 인증으로 전체 경로를 막는다 (`/api/v1/*` 포함 — 화면을 거치지 않고 API 만 부르는 것도 막힌다).

```bash
# EC2 에서
git clone https://github.com/cj-ai-sw/frontend.git ~/frontend && cd ~/frontend
cp .env.example .env
# .env 에 APP_PASSWORD 를 채운다. BACKEND_ORIGIN 은 기본값이면 된다.
sudo docker compose up -d --build
```

프론트 컨테이너는 백엔드 compose 가 만든 네트워크(`backend_default`)에 얹혀 `backend:8000` 으로 부른다. 그래서 백엔드 포트를 인터넷에 열지 않아도 화면이 동작한다. 백엔드가 먼저 떠 있어야 하고, 네트워크 이름이 다르면 `.env` 의 `BACKEND_NETWORK` 로 바꾼다.

접속은 `http://<서버주소>:3000` 이고 브라우저가 아이디·비밀번호를 묻는다. `.env` 의 `APP_USER` / `APP_PASSWORD` 와 맞아야 들어온다 — `APP_USER` 를 비워 두면 아이디는 검사하지 않는다. `APP_PASSWORD` 를 비우면 게이트가 꺼진다.

> Basic 인증은 자격증명을 요청마다 보낸다. 시연 서버에 HTTPS 가 없으므로 같은 망을 볼 수 있는 사람에게는 비밀번호가 노출된다. 시연 전용 비밀번호를 쓰고 끝나면 버린다.

## 자동 배포 (Vercel)

`develop` 에 머지되면 `.github/workflows/deploy-vercel.yml` 이 프로덕션으로 올린다.

Vercel 의 Git 연동은 쓰지 않는다 — Hobby 플랜에서는 조직 소유 저장소를 연결할 수 없다. 대신 CLI 가 소스를 직접 올리며, 이 경로에는 그 제한이 없다.

필요한 저장소 시크릿은 셋이다.

| 시크릿 | 값 |
| --- | --- |
| `VERCEL_TOKEN` | vercel.com/account/tokens 에서 발급 |
| `VERCEL_ORG_ID` | `.vercel/project.json` 의 `orgId` |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` 의 `projectId` |

환경변수는 저장소에 복제하지 않는다. 워크플로가 `vercel pull` 로 Vercel 에서 받아 오므로, 값을 바꿀 때는 Vercel 쪽만 고치면 된다.
