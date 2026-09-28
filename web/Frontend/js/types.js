/**
 * BROS - 프런트엔드 데이터 타입 정의 (JSDoc)
 * 별도 빌드/컴파일러 없이 순수 JS 환경에서 "타입 문서" 역할을 합니다.
 * VSCode 등 에디터에서 JSDoc을 인식하면 data.js 작성 시 자동완성/타입 힌트를 받을 수 있습니다.
 */

/**
 * ===== 투구/타격 AI 분석 리포트 (js/report.js 가 그대로 표시, 프론트는 계산하지 않음) =====
 * 향후 Python/FastAPI 가 GET /api/analysis/{id} 응답의 report 필드로 보내줄 형식.
 * 평가(좋음/나쁨, 권장 범위, 개선 포인트)는 넣지 않고 측정값만 보냄.
 *
 * 지표 값은 숫자 또는 { value, at } (at = 측정한 동작 단계 key, 예: "RELEASE")
 * @typedef {number | {value: number, at?: string}} MetricValue
 *
 * @typedef {Object} ReportVideoInfo
 * @property {"uploading"|"queued"|"processing"|"done"|"failed"} status
 * @property {string} [cameraView] "side" | "front" | "back" | "diagonal" (또는 표시할 글자)
 * @property {number} [fps]
 * @property {number} [durationSec] 영상 길이(초)
 * @property {number} [analyzedFrames] 분석한 프레임 수
 * @property {number} [detectedFrames] 선수가 검출된 프레임 수
 * @property {number} [metricCount] 측정 지표 수 (없으면 받은 지표 개수를 셈)
 * @property {string} [analyzedAt] "2026.09.28"
 * @property {string} [videoUrl] 분석 영상 주소 (있으면 ① 에서 재생)
 *
 * 동작 단계 1개. key 는 투구 SET/LEG_LIFT/STRIDE/ARM_COCKING/ACCELERATION/RELEASE/FOLLOW_THROUGH,
 * 타격 STANCE/LOAD/STRIDE/ROTATION/SWING/FOLLOW_THROUGH (추후 CONTACT 등 추가 가능)
 * @typedef {Object} ReportPhase
 * @property {string} key
 * @property {number} [startSec]
 * @property {number} [endSec]
 * @property {number} [startFrame]
 * @property {number} [endFrame]
 *
 * @typedef {Object} ReportPreviousAnalysis 같은 사용자의 이전 같은 종류 분석
 * @property {string} analyzedAt
 * @property {string} [fileName]
 * @property {Object.<string, MetricValue>} [angles]
 * @property {Object.<string, MetricValue>} [movement]
 * @property {Object.<string, MetricValue>} [sequence]
 * @property {Object.<string, number>} [changes] 지표 key → 변화값 (없으면 화면에서 현재 - 이전)
 *
 * @typedef {Object} AnalysisReport
 * @property {"pitching"|"batting"} analysisType
 * @property {ReportVideoInfo} videoInfo
 * @property {ReportPhase[]} phases
 * @property {Object.<string, MetricValue>} angles
 *   투구: elbowAngleAtRelease, shoulderAngleAtRelease, frontKneeAngle, backKneeAngle, trunkTilt, pelvisRotation, shoulderRotation (°), strideLength (신장 대비)
 *   타격: pelvisRotation, shoulderRotation, trunkTilt, frontKneeAngle, backKneeAngle (°), strideLength (신장 대비)
 * @property {Object.<string, MetricValue>} movement headDisplacement, pelvisDisplacement (정규화 좌표), trunkTiltChange (°)
 * @property {Object.<string, MetricValue>} sequence 시점/시간(초)
 *   투구: lowerBodyMoveStartSec, pelvisRotationStartSec, shoulderRotationStartSec, armAccelerationStartSec, releaseSec, pelvisToShoulderGapSec, totalMotionSec
 *   타격: loadStartSec, strideStartSec, frontFootLandingSec, pelvisRotationStartSec, shoulderRotationStartSec, swingStartSec, followThroughStartSec, pelvisToShoulderGapSec, totalSwingSec
 * @property {ReportPreviousAnalysis|null} previousAnalysis
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
 * @property {"P"|"C"|"1B"|"2B"|"3B"|"SS"|"LF"|"CF"|"RF"|null} position 포지션별 하이라이트 분류 기준. 타격/전체 주요 장면처럼 포지션이 없으면 null
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
