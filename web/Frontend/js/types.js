/**
 * BROS - 프런트엔드 데이터 타입 정의 (JSDoc)
 * 별도 빌드/컴파일러 없이 순수 JS 환경에서 "타입 문서" 역할을 합니다.
 * VSCode 등 에디터에서 JSDoc을 인식하면 data.js 작성 시 자동완성/타입 힌트를 받을 수 있습니다.
 */

/**
 * ===== 투구/타격 AI 분석 리포트 (js/report.js 가 그대로 표시, 프론트는 계산하지 않음) =====
 * Spring Boot API(GET /api/analysis/{id}) 응답의 report 필드 형식. 프론트는 Spring 하고만 통신합니다.
 *   흐름: 프론트 → Spring → Python AI(MediaPipe/YOLO 등 분석) → Spring(MySQL 저장, previousAnalysis 추가) → 프론트
 * 평가(좋음/나쁨, 권장 범위, 개선 포인트)는 넣지 않고 측정값만 보냄. 측정하지 못한 지표는 빼고 보냄(임의값 금지).
 *
 * 지표 값은 숫자 또는 { value, unit?, at? }
 *   unit: "deg" | "pct_height"(신장 대비 %) | "pct_body"(신체 기준 %) | "pct_shoulder"(어깨너비 대비 %) | "norm"(정규화 좌표)
 *         | "cm"(실측 보정 후) | "sec" | "ms" | "deg_per_sec"   — 없으면 지표의 기본 단위 (js/report.js REPORT_CONFIG)
 *   at: 측정 시점 동작 단계 key (예: "RELEASE")
 * @typedef {number | {value: number, unit?: string, at?: string}} MetricValue
 *
 * @typedef {Object} ReportVideoInfo
 * @property {"uploading"|"queued"|"processing"|"done"|"failed"} status
 * @property {"side"|"front"|"rear"} [cameraView] 촬영 방향 (기본 side). 방향마다 보여줄 지표가 다름
 * @property {number} [fps]
 * @property {number} [durationSec]
 * @property {number} [analyzedFrames]
 * @property {number} [detectedFrames]
 * @property {number} [metricCount] 없으면 받은 지표 수를 셈
 * @property {string} [analyzedAt] "2026.09.28"
 * @property {string} [videoUrl]
 *
 * 동작 단계. key 는 투구 SET/LEG_LIFT/STRIDE/ARM_COCKING/ACCELERATION/RELEASE/FOLLOW_THROUGH,
 * 타격 STANCE/LOAD/STRIDE/ROTATION/SWING/FOLLOW_THROUGH (추후 CONTACT 등 추가 가능)
 * @typedef {Object} ReportPhase
 * @property {string} key
 * @property {number} [startSec]
 * @property {number} [endSec]
 *
 * @typedef {Object} ReportPreviousAnalysis 같은 사용자의 이전 분석 (같은 종류·같은 촬영 방향, Spring 이 붙여줌)
 * @property {string} analyzedAt
 * @property {string} [fileName]
 * @property {string} [cameraView]
 * @property {Object.<string, MetricValue>} [angles]
 * @property {Object.<string, MetricValue>} [movement]
 * @property {Object.<string, MetricValue>} [timing]
 * @property {Object.<string, MetricValue>} [speed]
 * @property {Object.<string, number>} [changes] 지표 key → 변화값 (없으면 화면에서 같은 단위일 때만 현재 - 이전)
 *   → 핵심 지표의 "이전 대비" 와 AI 분석 요약의 "이전 분석에서는 ~로 측정되었습니다" 에 사용 (별도 비교 탭은 없음)
 *
 * @typedef {Object} AnalysisReport
 * @property {"pitching"|"batting"} analysisType
 * @property {ReportVideoInfo} videoInfo
 * @property {ReportPhase[]} phases
 * @property {Object.<string, MetricValue>} angles 관절 및 자세 (°)
 *   투구 side: elbowAngleAtRelease, frontKneeAngle, backKneeAngle, trunkForwardTilt, (shoulderLineTilt)
 *   타격 side: frontKneeAngle, backKneeAngle, trunkTilt, (elbowAngle)
 *   front/rear: shoulderLineTilt, pelvisLineTilt, landingFootAngle, (pelvisRotation, shoulderRotation — 검증 후에만)
 * @property {Object.<string, MetricValue>} movement 움직임 (%, 정규화)
 *   투구 side: strideLength, legLiftHeight (pct_height), headDisplacement, pelvisDisplacement, (releaseWristPosition) (pct_body)
 *   타격 side: strideLength (pct_height), headDisplacement, pelvisDisplacement, centerOfMassShift, (wristPath) (pct_body)
 *   front/rear: lateralCenterShift (pct_shoulder)
 * @property {Object.<string, MetricValue>} timing 동작 타이밍 (초, 영상 시작 기준)
 *   투구: legLiftPeakSec, strideStartSec, frontFootLandingSec, releaseSec, pelvisToShoulderSec, totalMotionSec,
 *         (pelvisRotationStartSec, shoulderRotationStartSec, armAccelerationStartSec, landingToReleaseSec)
 *   타격: loadStartSec, strideStartSec, frontFootLandingSec, pelvisRotationStartSec(로테이션 시작), swingStartSec,
 *         followThroughStartSec, pelvisToShoulderSec, totalSwingSec, (shoulderRotationStartSec, landingToSwingSec)
 *   (괄호) = 값이 올 때만 표시. 공이 없는 영상이라 공 기준의 빠른/늦은 타이밍은 다루지 않음
 * @property {Object.<string, MetricValue>} speed 동작 속도 (°/s, 현재 미지원 — 보내면 타이밍 탭 아래에 표시)
 *   pelvisAngularVelocityMax, trunkAngularVelocityMax, (투구) elbowExtensionVelocityMax
 * @property {ReportPreviousAnalysis|null} previousAnalysis
 * @property {(string|{category?: "angles"|"movement"|"timing"|"speed", title?: string, text: string})[]} [observations]
 *   AI 분석 요약 문장 (최대 3개 표시). 측정 결과 → 기본적인 야구 동작 관점의 의미 → 다음 촬영에서 확인해볼 부분 순서,
 *   단정 금지 (정상/비정상, 좋은/나쁜 폼, 부상 위험 등). Spring 이 전달하면 그대로, 없으면 화면에서
 *   generatePitchFeedback / generateBattingFeedback 으로 측정값에서 만듦 (generateAnalysisSummary)
 * @property {Object|null} [pose] AI-Server 의 프레임별 관절 좌표 (영상 위 관절 점 표시용)
 */

/**
 * 메인 4대 기능 메뉴 카드 (AI 투구폼 분석 등)
 * @typedef {Object} FeatureMenuItem
 * @property {string} id
 * @property {"pitching"|"batting"|"highlight"|"mypage"} icon
 * @property {string} title
 * @property {string} description
 * @property {string} href
 * @property {"neon"|"gold"|"navy"} accent 아이콘 배지 색
 */

/**
 * HOW IT WORKS 단계
 * @typedef {Object} HowItWorksStep
 * @property {number} step
 * @property {"upload"|"analyze"|"result"} icon
 * @property {string} title
 * @property {string} description
 */

/**
 * 좌측 사이드바 내비게이션 항목
 * @typedef {Object} NavItem
 * @property {string} key
 * @property {"pitching"|"batting"|"highlight"|"mypage"} icon
 * @property {string} label
 * @property {string} href 실제 페이지 경로 (예: "./pitching.html")
 */

/**
 * 요약 정보 박스 1개 (분석 유형 / 분석 상태)
 * @typedef {Object} ReportBadgeInfo
 * @property {string} [icon]
 * @property {string} label
 * @property {string} [description]
 */

/**
 * 값 + 보조 설명 한 쌍 (측정 지표 박스)
 * @typedef {Object} ReportValue
 * @property {string} value 크게 보이는 값 (예: "2개", "준비 중")
 * @property {string} description 아래 작은 설명
 */

/**
 * 투수/타자 탭 1개에 해당하는 "오늘의 AI 리포트" 내용.
 * js/main.js 가 GET /api/mypage/report-summary 응답(또는 로그인 전 안내 문구)으로 만듭니다.
 * @typedef {Object} TypeReport
 * @property {ReportBadgeInfo} analysisType 분석 유형 박스
 * @property {ReportBadgeInfo} overallStatus 분석 상태 박스
 * @property {string} recentAnalysisDate 최근 분석 박스에 쓰일 날짜 문자열 (예: "2026.09.28", 없으면 "-")
 * @property {ReportValue} improvementPoints 측정 지표 박스
 * @property {string} aiSummaryComment AI 코멘트 박스 문구
 * @property {{label: string, href: string}} cta 코멘트 아래 버튼
 */

/**
 * 경기 하이라이트 클립 1개. 백엔드 AI 분석 결과가 이 형태로 내려오면 그대로 렌더링에 쓸 수 있습니다.
 * @typedef {Object} HighlightClip
 * @property {string} id
 * @property {"batting"|"defense"|"highlight"} category 전체 하이라이트 화면에서의 그룹 (타격 장면/수비 플레이/주요 플레이)
 * @property {string} action 장면 종류 코드 (예: "ground_ball", "throw", "fly_out", "hit")
 * @property {string} actionLabel 화면에 보여줄 한글 라벨 (예: "2회 땅볼 처리")
 * @property {string} timestamp 영상 내 시간 위치, "HH:MM:SS" (예: "00:13:21")
 * @property {string} clipUrl 클립 영상 URL (아직 없으면 빈 문자열)
 * @property {string} thumbnailUrl 썸네일 이미지 URL (아직 없으면 빈 문자열 → placeholder 표시)
 */

/**
 * 경기 하이라이트 상단에 표시되는 경기 정보
 * @typedef {Object} GameInfo
 * @property {string} date 경기 날짜
 * @property {string} opponent 상대팀
 * @property {string} score 최종 스코어 문자열 (예: "BROS 7 : 3")
 */

// 브라우저 전역 네임스페이스 (모듈 번들러 없이 스크립트 태그로만 동작)
window.BROS = window.BROS || {};
