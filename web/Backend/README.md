# BROS 백엔드 (Spring Boot)

프론트(`web/Frontend`)와 AI-Server(FastAPI, YOLO26 Pose) 사이에서 동작하는 Spring 백엔드입니다.

- **회원가입/로그인**: 세션 기반, 비밀번호는 BCrypt 해시, 가입하면 `PENDING`(승인 대기) 상태로 저장
- **관리자 승인**: 관리자가 `admin.html` 에서 가입 신청을 승인/거절. 승인(`APPROVED`)된 회원만 로그인 가능
- **영상 분석 업로드/조회**: 프론트 → **Spring(프록시)** → AI-Server 로 전달. 누가 언제 올렸는지는 MySQL 에 저장
- **마이페이지**: 로그인한 사용자의 분석 기록/업로드 영상 목록 (로그인 필수, 세션 없으면 401)
- **경기 하이라이트**: 최신 경기 + 하이라이트 클립 목록 조회

## 1. STS(Eclipse)로 가져오기

1. STS 실행 → `File > Import > Maven > Existing Maven Projects`
2. 이 폴더(`web/Backend`)를 선택 → Finish
3. 처음 임포트하면 Maven 이 의존성을 자동으로 다운로드합니다 (인터넷 필요)

> STS workspace 폴더(`.metadata` 가 생기는 곳)는 이 저장소 **밖**에 두세요.

## 2. MySQL 준비

```sql
CREATE DATABASE baseball_ai DEFAULT CHARACTER SET utf8mb4;
```

테이블은 `ddl-auto: update` 설정 덕분에 서버를 처음 실행하면 자동으로 생성됩니다 (users, analysis_records, games, highlight_clips).

## 3. 내 PC 전용 설정 파일 만들기 (필수)

저장소가 Public 이라서 **MySQL 비밀번호와 관리자 계정은 git 에 올리지 않습니다.**
`src/main/resources/application-local.example.yml` 을 같은 폴더에 `application-local.yml` 로 복사한 뒤, 값을 **본인 것으로** 바꾸세요.

```yaml
spring:
  datasource:
    username: root               # 본인 MySQL 계정
    password: 본인_MySQL_비밀번호

app:
  admin:
    username: admin              # 처음 켤 때 자동으로 만들어질 관리자 아이디
    password: 관리자_비밀번호
    name: 관리자
```

- `application-local.yml` 은 `.gitignore` 에 들어 있어서 커밋되지 않습니다. 다른 사람이 쓰던 비밀번호를 그대로 두면 당연히 연결이 안 되니 꼭 본인 값으로 바꾸세요.
- 이 파일이 없으면 `application.yml` 의 기본값(`root` / `changeme`)으로 접속을 시도하다가 실패합니다.

## 4. 포트 확인 (8080 vs 8081)

`application.yml` 의 `server.port` 는 **8081** 로 되어 있습니다. 개발 PC에서 8080 이 이미 사용 중이어서 바꾼 값입니다.

- 본인 PC에서 8080 이 비어 있으면 8080 으로 바꿔도 되고, 8081 그대로 써도 됩니다.
- 실행했는데 `Port 8081 was already in use` (또는 8080) 가 뜨면 비어 있는 다른 포트로 바꾸세요.
- **포트를 바꾸면 프론트 `web/Frontend/js/api.js` 의 `API_PORT` 도 실제로 뜬 포트로 똑같이 바꿔야 합니다.**

```js
const API_PORT = 8081;
```

## 5. AI-Server 주소 확인

`application.yml` 의 `ai-server.base-url` 이 실제 AI-Server 주소(기본 `http://localhost:8000`)와 맞는지 확인하세요.
AI-Server 는 그대로 `uvicorn main:app --reload --port 8000` 으로 따로 실행해두면 됩니다.

## 6. 실행

STS 에서 `BrosBackendApplication.java` 우클릭 → `Run As > Spring Boot App`
(또는 터미널에서 `mvn spring-boot:run`)

콘솔에 `[BROS] 관리자 계정을 생성했습니다: admin` 이 한 번 찍히면 관리자 계정이 만들어진 것입니다 (다음 실행부터는 이미 있으니 안 찍힘).
`GET http://localhost:8081/api/highlights/latest` 등으로 확인해보세요 (경기 데이터를 아직 안 넣었으면 404 가 정상입니다).

## 7. 프론트 띄우기

프론트를 `file://` 로 직접 열면 브라우저가 origin 을 `null` 로 취급해서 **세션 쿠키(로그인)가 동작하지 않습니다.**
VSCode Live Server 등으로 `http://localhost:5500` 같은 주소로 띄우세요.
다른 포트를 쓰면 `application.yml` 의 `app.cors.allowed-origins` 에 그 주소를 추가해야 합니다.

## 8. 회원가입 → 승인 → 로그인 흐름

1. `login.html` 회원가입 탭에서 가입 신청 → `PENDING` 으로 저장
2. 이 상태로 로그인하면 "관리자 승인 대기 중입니다" 로 막힘 (403)
3. 관리자 계정으로 로그인 → 마이페이지의 **회원 승인 관리** 버튼 → `admin.html`
4. 승인하면 `APPROVED` → 그 회원이 로그인 가능 / 거절하면 `REJECTED` → 로그인 불가
5. 이미 로그인해 있던 회원을 거절로 바꾸면, 다음에 페이지를 열 때 로그아웃 처리됩니다

처음 만들어진 관리자 비밀번호는 로그인 후 **마이페이지 → 비밀번호 변경**에서 꼭 바꾸세요 (예시처럼 쉬운 비밀번호면 Chrome 이 "유출된 비밀번호" 경고를 띄웁니다).

관리자를 한 명 더 만들고 싶으면 그 사람이 가입한 뒤 MySQL 에서 직접 바꾸면 됩니다.

```sql
UPDATE users SET role = 'ADMIN', status = 'APPROVED' WHERE username = '아이디';
```

## 9. API 목록

| Method | URL | 설명 | 로그인 필요 |
|---|---|---|---|
| POST | `/api/auth/signup` | 회원가입 (`{name, username, password}`) → 승인 대기로 저장 | X |
| GET | `/api/auth/check-username?username=` | 아이디 중복확인 | X |
| POST | `/api/auth/login` | 로그인 (`{username, password}`), 세션 쿠키 발급. 응답 `{username, name, role}` | X |
| POST | `/api/auth/logout` | 로그아웃 | X |
| GET | `/api/auth/me` | 현재 로그인 사용자 정보 `{username, name, role, status, createdAt, reviewedAt, profileImageUrl}` | O |
| POST | `/api/auth/password` | 비밀번호 변경 (`{currentPassword, newPassword}`, 새 비밀번호 8자 이상) | O |
| POST | `/api/analysis` | 영상 업로드 → AI-Server 프록시 (multipart: `video`, `analysisType`) | X (로그인 시 자동으로 내 기록으로 연결) |
| GET | `/api/analysis/{videoId}` | 분석 상태/결과 조회 → AI-Server 프록시 | X |
| GET | `/api/mypage/analysis-records` | 내 분석 기록/업로드 영상 목록 | **O** |
| GET | `/api/mypage/report-summary` | 홈 "오늘의 AI 리포트" 투구/타격별 요약 (분석 수, 최근 영상·상태·날짜) | **O** |
| GET | `/api/mypage/profile-image` | 내 프로필 사진 (img src 로 사용) | **O** |
| POST | `/api/mypage/profile-image` | 프로필 사진 등록/변경 (multipart: `image`, JPG/PNG/WEBP/GIF, 5MB 이하) | **O** |
| DELETE | `/api/mypage/profile-image` | 프로필 사진 삭제 | **O** |
| GET | `/api/highlights/latest` | 최신 경기 + 하이라이트 클립 | X |
| GET | `/api/admin/users?status=PENDING` | 회원 목록 (`PENDING`/`APPROVED`/`REJECTED`, 생략하면 전체) | **관리자** |
| POST | `/api/admin/users/{id}/approve` | 가입 승인 | **관리자** |
| POST | `/api/admin/users/{id}/reject` | 가입 거절 | **관리자** |
| GET | `/api/admin/highlights/games` | 경기 목록 (장면 수, 하이라이트에 표시 중인 경기) | **관리자** |
| POST | `/api/admin/highlights/games` | 경기 등록 (`{gameDate: "2026-09-20", opponent, score}`) | **관리자** |
| DELETE | `/api/admin/highlights/games/{id}` | 경기 삭제 (장면도 함께) | **관리자** |
| GET | `/api/admin/highlights/games/{id}/clips` | 장면 목록 | **관리자** |
| POST | `/api/admin/highlights/games/{id}/clips` | 장면 추가 (`{category, position, actionLabel, timestamp: "00:34:02", clipUrl}`) | **관리자** |
| DELETE | `/api/admin/highlights/clips/{id}` | 장면 삭제 | **관리자** |

**에러 응답은 모두 `{"detail": "메시지"}` 형태로 통일되어 있습니다.** 프론트(`js/api.js`, `js/analysis.js`)는 이 `detail` 을 그대로 화면에 보여줍니다.

## 10. 프론트 연동 현황

아래는 모두 반영되어 있습니다. 새로 API 를 호출하는 코드를 짤 때도 같은 규칙을 지키면 됩니다.

- 백엔드 주소는 **`js/api.js` 한 곳**에서만 관리 (`analysis.js` 도 이 값을 씀). 포트는 `API_PORT`, 호스트는 페이지를 연 주소(`localhost` 또는 `127.0.0.1`)를 그대로 따라감 — 둘이 다르면 브라우저가 로그인 쿠키를 저장하지 않기 때문
- 모든 요청에 `credentials: "include"` 를 붙여서 세션 쿠키가 전달됨 (`api.request()` 를 쓰면 자동)
- `js/auth.js`: 로그인/회원가입/아이디 중복확인이 실제 API 호출
- `js/shell.js`: 로그아웃 시 서버 세션도 끊고, 세션이 만료되면 화면의 로그인 표시도 풀림
- `mypage.html` + `js/mypage.js`: 프로필 사진, 내 정보, `/api/mypage/analysis-records` 로 "분석 기록"/"업로드한 영상" 목록 표시, 기록을 누르면 해당 분석 페이지에서 결과를 이어서 보여줌
- `index.html` + `js/main.js`: 홈 "오늘의 AI 리포트" 를 `/api/mypage/report-summary` 로 표시 (로그인 전에는 안내 문구, 측정 지표 칸은 "준비 중")
- `pitching.html` / `batting.html` + `js/report.js`: 투구/타격 AI 분석 리포트 ①~⑧ (평가 없이 측정값·이전 분석 비교만). 분석 상태 조회 결과(`/api/analysis/{id}`)의 `summary` 로 영상 정보를, `includePose=true` 의 `pose` 로 영상 위 관절 점을 그림. 관절 각도·동작 단계 등은 AI-Server 가 응답에 `report` 필드(형식: `js/types.js` 의 `AnalysisReport`)를 넣으면 그대로 표시 (Spring 은 `AnalysisStatusResponse.report` 로 전달만 함)
- `js/video-player.js`: 분석용 영상 플레이어 공통 (재생속도 0.25x~2x `setPlaybackRate`, 관절 점 오버레이 `createPoseOverlay`)
- `highlight.html` + `js/highlight.js`: `/api/highlights/latest` 로 최신 경기와 장면 목록 표시 (영상 주소 `clip_url` 이 있으면 새 탭 재생)
- `admin.html` + `js/admin.js` / `js/admin-highlight.js`: 관리자 화면 (회원 승인 / 하이라이트 관리 탭, `admin.html#highlights` 로 바로 열림)
- `password.html` + `js/password.js`: 비밀번호 변경 화면 (마이페이지 내 정보의 "비밀번호 변경" 버튼)
- 프로필 사진 파일은 백엔드 실행 위치 기준 `uploads/profile/` 에 저장됨 (`app.upload-dir`, git 제외). DB 에는 파일 이름만 저장

## 11. 문제 해결

| 증상 | 원인 / 해결 |
|---|---|
| 페이지 주소 자체가 404 (`http://127.0.0.1:5500/web/Frontend/login.html`) | 5500 포트를 Live Server 가 아닌 다른 프로그램이 쓰고 있음. 그 프로그램을 끄고 Live Server 를 다시 켜기 |
| API 가 404 `"요청한 API 를 찾을 수 없습니다"` | 백엔드가 예전 코드로 떠 있음. STS 에서 `web/Backend` 프로젝트로 다시 실행 |
| 분석 페이지 결과 카드에 "연결 실패 / AI 서버에 연결할 수 없어요" | AI-Server(8000)가 꺼져 있음. `uvicorn main:app --port 8000` 으로 켜기 (마이페이지 목록은 AI-Server 가 꺼져 있어도 마지막 상태로 보임) |
| 로그인 누르면 잠깐 됐다가 다시 로그인 전 상태로 돌아옴 | 페이지 주소와 API 주소의 호스트가 다름(`127.0.0.1` ↔ `localhost`) → 쿠키가 저장 안 됨. `api.js` 가 자동으로 맞추므로 `api.js` 를 직접 `localhost` 로 고정하지 말 것 |
| 로그인했는데 새로고침하면 풀림 / 마이페이지가 로그인으로 튕김 | 프론트를 `file://` 로 열었거나, 프론트 주소가 `app.cors.allowed-origins` 에 없음. 또는 세션 30분 만료 |
| 콘솔에 `401 /api/auth/me` 가 한 번 찍힘 | 로그인 표시는 남아 있는데 서버 세션이 만료된 경우로, 화면을 자동으로 로그아웃 상태로 맞추는 정상 동작 |

## 12. 아직 안 된 것 (다음 단계 후보)

- **하이라이트 자동 생성**: 지금은 관리자가 화면에서 경기/장면을 직접 등록합니다. 경기 영상에서 장면을 자동으로 찾으려면 AI-Server 에 장면(동작) 인식 모델이 추가로 필요합니다.
- 자세 평가(관절 각도 계산, 개선 포인트 산출, 홈 리포트의 "AI 코멘트") — `pose` 데이터(24개 관절)는 이미 받아오고 있어서, 이 위에 로직만 추가하면 됩니다
- 경기 하이라이트 자동 생성 파이프라인
