/**
 * BROS - 프런트엔드 데이터 타입 정의 (JSDoc)
 * 별도 빌드/컴파일러 없이 순수 JS 환경에서 "타입 문서" 역할을 합니다.
 * VSCode 등 에디터에서 JSDoc을 인식하면 data.js 작성 시 자동완성/타입 힌트를 받을 수 있습니다.
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
 * 요약 정보 박스 1개 (분석 유형 / AI 종합 상태)
 * @typedef {Object} ReportBadgeInfo
 * @property {string} icon
 * @property {string} label
 * @property {string} [description]
 */

/**
 * 주요 개선 포인트 개수 + 목록
 * @typedef {Object} ImprovementPoints
 * @property {number} count
 * @property {string[]} items
 */

/**
 * 투수/타자 탭 1개에 해당하는 "오늘의 AI 리포트" 내용
 * @typedef {Object} TypeReport
 * @property {ReportBadgeInfo} analysisType 분석 유형 박스
 * @property {ReportBadgeInfo} overallStatus AI 종합 상태 박스
 * @property {string} recentAnalysisDate 최근 분석 박스에 쓰일 날짜 문자열 (예: "2024.06.10")
 * @property {ImprovementPoints} improvementPoints 주요 개선 포인트 박스
 * @property {string} aiSummaryComment AI 코멘트 박스 문구
 */

/**
 * 오늘의 AI 리포트 (대시보드 전체 데이터)
 * @typedef {Object} DailyReport
 * @property {string} id
 * @property {Object.<string, TypeReport>} reportsByType "pitching"/"batting" 탭별 리포트 데이터
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
