# Git 사용 가이드 (baseball_AI)

- 저장소: https://github.com/yyc8422-arch/baseball_AI (Private, 개인 계정 `yyc8422-arch`)
- 기본 브랜치: `main`
- 이 폴더의 git 은 개인 저장소에만 연결되어 있고, hexagon 쪽 저장소와는 별개입니다.

---

## 1. 매일 쓰는 기본 흐름

```bash
git add .                        # ① 바뀐 파일을 전부 "올릴 목록"에 담기
git commit -m "무엇을 했는지"      # ② 담은 것을 하나의 기록(커밋)으로 저장 (아직 내 PC에만)
git push                         # ③ GitHub 에 올리기
```

예시:

```bash
git add .
git commit -m "결과 조회 API 추가"
git push
```

## 2. 올리기 전에 확인하기

```bash
git status          # 어떤 파일이 바뀌었는지, 올릴 목록에 뭐가 담겼는지
git diff            # 바뀐 내용을 줄 단위로 보기 (q 로 나가기)
git log --oneline   # 지금까지의 커밋 기록 (q 로 나가기)
```

### 커밋 기록 자세히 보기 (`git log`)

```bash
git log                     # 전체 기록: 커밋 번호, 작성자, 날짜, 메시지
git log --oneline           # 한 줄씩 짧게 (가장 많이 씀)
git log --oneline -5        # 최근 5개만
git log --stat              # 커밋마다 어떤 파일이 몇 줄 바뀌었는지
git log -p 파일명            # 특정 파일이 커밋마다 어떻게 바뀌었는지 내용까지
git log --oneline -- web/   # 특정 폴더(web)를 건드린 커밋만
git log --oneline --graph --all   # 브랜치 흐름을 그림처럼 보기
git show 6629ec1            # 커밋 하나의 변경 내용 보기 (번호는 git log 에서 복사)
```

`git log --oneline` 결과 읽는 법:

```
6629ec1 (HEAD -> main, origin/main) Spring/STS 빌드 및 설정 파일 git 제외 추가
96503e2 분석 결과 조회 API 추가 및 프론트엔드 업로드 연동
```

- 앞의 `6629ec1` 은 커밋 번호입니다. `git show` 같은 명령어에 이 번호를 넣어서 씁니다.
- `HEAD -> main` 은 내 PC 에서 지금 보고 있는 위치입니다.
- `origin/main` 은 GitHub 에 올라간 위치입니다.
- **둘이 같은 줄에 있으면 push 가 다 된 상태**입니다. `HEAD` 가 더 위에 있으면 아직 push 안 한 커밋이 있다는 뜻입니다.

## 3. 다른 컴퓨터에서 작업할 때

```bash
git clone https://github.com/yyc8422-arch/baseball_AI.git   # 처음 한 번: 저장소 전체 받기
git pull                                                     # 작업 시작 전: 최신 내용 받기
```

> PC 두 대를 번갈아 쓴다면 **작업 시작 전 `git pull` → 작업 끝나면 `git push`** 습관을 들이면 충돌이 거의 생기지 않습니다.

clone 한 뒤 서버 실행 준비:

```bash
cd AI-Server
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## 4. 실수했을 때

```bash
git restore 파일명            # 아직 커밋 안 한 수정 내용을 되돌리기 (⚠️ 수정한 내용이 사라짐)
git restore --staged 파일명   # add 로 담은 파일을 목록에서만 빼기 (내용은 그대로)
git commit --amend -m "새 메시지"   # 방금 한 커밋의 메시지 수정 (push 하기 전에만!)
```

## 5. GitHub 에 올라가지 않는 것 (`.gitignore`)

| 대상 | 이유 |
|---|---|
| `Baseball_Sample/`, `baseball_dataset/`, `*.zip` | AIHUB 원본 데이터: 용량이 크고 외부 공개 불가. 학습은 Colab + 구글 드라이브에서 |
| `.venv/`, `__pycache__/` | 각 PC 에서 새로 만드는 파일 |
| `runs/`, `AI-Server/models/*.pt` | 학습 결과와 모델 파일. 구글 드라이브에 보관하고 PC 에 직접 넣어 사용 |
| `.metadata/`, `.settings/`, `.project`, `.classpath`, `target/`, `build/`, `.gradle/` 등 | STS 설정 파일과 Spring 빌드 결과물. 각 PC 에서 새로 생김 |
| `.env` | 비밀번호, API 키 같은 비밀값 |
| `AI-Server/storage/uploads, tmp, results` 안의 파일 | 업로드된 영상과 분석 결과 |

## 6. 이 프로젝트에서 자주 할 작업

**학습한 모델 넣기**

모델 파일(`*.pt`)은 GitHub 에 올리지 않습니다. (`AI-Server/.gitignore` 에서 제외)

1. Colab 에서 받은 `best_baseball_pose.pt` 를 `AI-Server/models/` 에 넣기
2. 서버 재시작 (commit / push 필요 없음)

> 다른 PC 에서 clone 했다면 모델 파일이 없으므로 구글 드라이브(`BROS_DATA/best_baseball_pose.pt`)에서 받아 같은 위치에 넣습니다.
> 모델이 없어도 서버는 켜지고 업로드도 되지만, 분석 결과는 `failed` 로 기록됩니다.

## 7. 팁

- `git add` 할 때 뜨는 `LF will be replaced by CRLF` 경고는 Windows 줄바꿈 형식 안내라서 무시해도 됩니다.
- 커밋은 기능 하나 단위로 작게, 자주 하는 게 좋습니다. (예: "모델 연결", "조회 API 추가")
- 커밋 메시지는 "무엇을 했는지"가 드러나게 씁니다. (`수정`, `ㅇㅇ` 같은 메시지는 나중에 찾기 어려움)
- VSCode 왼쪽 **소스 제어** 아이콘(가지 모양)에서 버튼으로도 할 수 있습니다.
  메시지 입력 → ✓ (커밋) → 동기화 (푸시)
- 처음 push 할 때 로그인 창이 뜨면 반드시 **개인 계정 `yyc8422-arch`** 로 로그인합니다.
