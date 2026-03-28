# Studio Edit 87

NovelAI(NAI) + **ComfyUI** 듀얼 백엔드를 지원하는 AI 이미지 생성 관리 웹 애플리케이션.

> 원본 [87-Studio](https://github.com/snuff8729/87-studio)를 기반으로, ComfyUI 백엔드 지원을 추가한 포크입니다.

---

## 주요 기능

### 이미지 생성
- **듀얼 백엔드** — NovelAI / ComfyUI 중 선택하여 이미지 생성
- **배치 이미지 생성** — 여러 씬을 한번에 선택하여 대량 생성, 비동기 큐 처리
- **Quick Generate** — 프로젝트 없이 즉시 이미지 생성

### ComfyUI 지원 (New)
- **워크플로우 관리** — JSON 워크플로우 업로드, 파라미터 자동 매핑
- **동적 모델/샘플러 조회** — ComfyUI 서버에서 사용 가능한 체크포인트, 샘플러, 스케줄러 실시간 조회
- **WebSocket 진행률** — 생성 진행 상황 실시간 모니터링
- **연결 테스트** — 설정 페이지에서 ComfyUI 서버 연결 확인

### 프롬프트 관리
- **프롬프트 프리셋 관리** — 씬 팩/씬 기반 포즈/제스처 프리셋 템플릿
- **플레이스홀더 시스템** — `\placeholder\` 구문으로 씬별 가변 값 삽입
- **프롬프트 번들** — `@{bundle}` 참조로 재사용 가능한 프롬프트 스니펫
- **다중 캐릭터** — 프로젝트 내 여러 캐릭터 슬롯, 캐릭터별 씬 오버라이드

### 갤러리 & 관리
- **갤러리** — 프로젝트/씬/즐겨찾기/태그 필터링, 별점, 메모
- **이상형 월드컵** — 이미지 1:1 비교 랭킹
- **메타데이터 인스펙터** — NAI 이미지 메타데이터 추출
- **일괄 다운로드** — ZIP 다운로드 (파일명 템플릿 지원)

### 기타
- **온보딩** — 처음 사용자를 위한 단계별 가이드
- **다국어** — English / 한국어
- **반응형** — 데스크톱 + 태블릿 + 모바일

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | TanStack Start + Vite 7 |
| 프론트엔드 | React 19, TypeScript, shadcn/ui, Tailwind CSS 4 |
| 데이터베이스 | SQLite (better-sqlite3) + Drizzle ORM |
| 에디터 | CodeMirror 6 (Danbooru 태그 자동완성) |
| 서버 | Nitro (프로덕션) |

---

## Windows 로컬 설치 및 실행

### 방법 1: 원클릭 실행 (초보자 추천)

Node.js가 설치되어 있지 않아도 됩니다. `start.bat`이 모든 것을 자동으로 처리합니다.

#### 1단계: 프로젝트 다운로드

```
# Git이 설치된 경우
git clone https://github.com/ohardcore/studio-edit-87.git

# 또는 GitHub에서 ZIP 다운로드
# https://github.com/ohardcore/studio-edit-87/archive/refs/heads/main.zip
# 다운로드 후 원하는 폴더에 압축 해제
```

#### 2단계: 실행

```
studio-edit-87 폴더에서 start.bat 더블클릭
```

자동으로 수행되는 작업:
1. Node.js v22 다운로드 (첫 실행 시, `runtime/` 폴더에 저장)
2. 의존성 설치 (첫 실행 시)
3. 데이터베이스 마이그레이션
4. 애플리케이션 빌드 (첫 실행 시)
5. 서버 시작 → 브라우저에서 `http://localhost:3000` 자동 오픈

> 첫 실행 시 5~10분 소요될 수 있습니다. 이후 실행은 수 초 내에 완료됩니다.

#### 종료

CMD 창을 닫거나 `Ctrl+C`를 누르면 서버가 종료됩니다.

---

### 방법 2: 수동 설치 (개발자)

#### 사전 요구사항

- **Node.js v22.12+** — [다운로드](https://nodejs.org/)
- **pnpm** — Node.js 설치 후 `npm install -g pnpm` 으로 설치

#### 설치

```powershell
# 1. 프로젝트 클론
git clone https://github.com/ohardcore/studio-edit-87.git
cd studio-edit-87

# 2. 의존성 설치
pnpm install

# 3. 데이터베이스 마이그레이션
pnpm db:migrate

# 4-A. 개발 모드 (핫 리로드)
pnpm dev
# → http://localhost:3000

# 4-B. 프로덕션 빌드 & 실행
pnpm build
pnpm start
# → http://localhost:3000
```

#### 테스트

```powershell
pnpm test             # 전체 테스트 실행 (vitest)
pnpm test -- --watch  # 워치 모드
```

#### DB 관리

```powershell
pnpm db:generate      # 마이그레이션 생성 (스키마 변경 후)
pnpm db:migrate       # 마이그레이션 적용
pnpm db:studio        # Drizzle Studio (DB 브라우저)
```

---

## 사용 방법

### 초기 설정

1. 브라우저에서 `http://localhost:3000` 접속
2. 좌측 메뉴에서 **Settings (설정)** 클릭

#### 백엔드 선택

설정 페이지 최상단에서 **Generation Backend**를 선택합니다:

- **NovelAI** — NAI API Key 입력 후 Validate 클릭
- **ComfyUI** — 아래 ComfyUI 설정 섹션 참조

### NovelAI 모드

1. Settings에서 `NovelAI` 선택
2. NAI API Key 입력 → Validate로 검증
3. 프로젝트 생성 또는 Quick Generate에서 이미지 생성

### ComfyUI 모드

#### 사전 준비: ComfyUI 설치 & 실행

ComfyUI가 별도로 설치되어 실행 중이어야 합니다:

1. [ComfyUI](https://github.com/comfyanonymous/ComfyUI) 설치
2. ComfyUI 실행 (기본: `http://127.0.0.1:8188`)

#### Studio에서 ComfyUI 연결

1. Settings에서 `ComfyUI` 선택
2. **Server URL** 입력 (기본: `http://localhost:8188`)
3. **Test Connection** 클릭 → "Connected" 확인
4. **워크플로우 업로드**:
   - ComfyUI에서 만든 워크플로우를 **API 형식 JSON**으로 저장
     - ComfyUI에서 `Settings` → `Enable Dev mode options` 활성화
     - 메뉴에서 `Save (API Format)` 클릭하여 JSON 저장
   - Settings의 Workflows 섹션에서 `Upload Workflow JSON` 클릭
   - 업로드한 워크플로우를 `Set as Default`로 기본 설정

#### 워크플로우 파라미터 자동 매핑

업로드된 워크플로우의 노드가 자동으로 감지됩니다:

| 노드 타입 | 매핑 대상 |
|-----------|-----------|
| KSampler | seed, steps, cfg, sampler, scheduler |
| EmptyLatentImage | width, height |
| CheckpointLoaderSimple | 체크포인트 모델 |
| CLIPTextEncode (positive) | 긍정 프롬프트 |
| CLIPTextEncode (negative) | 부정 프롬프트 |

> 복잡한 워크플로우 (다중 KSampler 등)는 노드가 하나씩만 있을 때 자동 매핑됩니다.

### 이미지 생성 워크플로우

1. **프로젝트 생성** → 캐릭터 슬롯 추가 → 프롬프트 템플릿 작성
2. **씬 팩 생성** → 씬(포즈/제스처) 추가
3. 프로젝트에 씬 팩 할당 → 캐릭터별 오버라이드 편집
4. **씬 선택** (다중 가능) → **배치 생성**
5. **갤러리**에서 결과 확인 → 즐겨찾기/별점/태그 선별
6. **이상형 월드컵**으로 이미지 랭킹
7. 갤러리에서 일괄 다운로드

### Quick Generate

프로젝트 없이 빠르게 이미지를 생성할 수 있습니다:

1. 좌측 메뉴에서 **Generate** 클릭
2. 프롬프트 입력 (긍정/부정)
3. 파라미터 설정 (모델, 해상도, 스텝 등)
4. 생성 버튼 클릭

---

## 폴더 구조

```
studio-edit-87/
├── src/
│   ├── components/         # React UI 컴포넌트
│   │   ├── workspace/      #   워크스페이스 (파라미터, 참조, 에디터)
│   │   ├── prompt-editor/  #   프롬프트 에디터 (CodeMirror)
│   │   └── ui/             #   기본 UI 컴포넌트 (shadcn)
│   ├── lib/                # 공유 유틸리티
│   │   ├── i18n/           #   다국어 (en, ko)
│   │   └── use-backend.ts  #   백엔드 설정 훅
│   ├── routes/             # 페이지 라우트
│   │   ├── settings/       #   설정 (백엔드 선택, API 키, ComfyUI)
│   │   ├── workspace/      #   프로젝트 워크스페이스
│   │   ├── generate/       #   Quick Generate
│   │   ├── gallery/        #   갤러리
│   │   └── queue/          #   생성 큐
│   └── server/
│       ├── services/       # 비즈니스 로직
│       │   ├── backend.ts  #   백엔드 추상화 (NAI/ComfyUI 분기)
│       │   ├── nai.ts      #   NovelAI API 클라이언트
│       │   ├── comfyui.ts  #   ComfyUI API 클라이언트
│       │   ├── comfyui-workflow.ts  # 워크플로우 관리
│       │   └── generation.ts       # 큐 엔진
│       ├── functions/      # 서버 함수 (API)
│       └── db/             # 데이터베이스 스키마 & 마이그레이션
├── data/                   # 런타임 데이터 (DB, 이미지, 로그)
├── start.bat               # Windows 원클릭 실행
├── start.sh                # Linux/macOS 원클릭 실행
└── package.json
```

---

## NAI vs ComfyUI 비교

| 항목 | NovelAI | ComfyUI |
|------|---------|---------|
| 설정 | API Key | 서버 URL + 워크플로우 JSON |
| 모델 | NAI 전용 모델 (V3, V4, V4.5) | 모든 SD 체크포인트 |
| 참조 이미지 | Vibe Transfer, Precise Reference | 워크플로우에서 직접 관리 (IPAdapter 등) |
| 프롬프트 | NAI V4 캐릭터 프롬프트 지원 | 텍스트 합쳐서 전달 |
| 실행 환경 | 클라우드 (NAI 서버) | 로컬 GPU |

---

## 알려진 제한사항

- ComfyUI 모드에서 캐릭터 프롬프트는 하나의 텍스트로 합쳐짐 (NAI의 per-character positioning 미지원)
- 참조 이미지 (Vibe Transfer / Precise Reference)는 NAI 전용 — ComfyUI는 워크플로우에서 IPAdapter 등으로 직접 관리
- ComfyUI 시드는 32비트로 제한 (UI 호환성)

---

## 라이선스

[PolyForm Noncommercial License 1.0.0](LICENSE)

---

## 크레딧

- 원본: [87-Studio](https://github.com/snuff8729/87-studio) by snuff8729
- ComfyUI 백엔드 추가: ohardcore
