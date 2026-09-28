/**
 * BROS - 목(mock) 데이터
 * 실제 서비스에서는 이 파일 대신 API 응답을 types.js 의 타입 형태로 매핑해서 사용합니다.
 */

/** @type {NavItem[]} */
const NAV_ITEMS = [
  { key: "pitching", icon: "pitching", label: "AI 투구폼 분석", href: "./pitching.html" },
  { key: "batting", icon: "batting", label: "AI 타격폼 분석", href: "./batting.html" },
  { key: "highlight", icon: "highlight", label: "경기 하이라이트", href: "./highlight.html" },
  { key: "mypage", icon: "mypage", label: "마이페이지", href: "./mypage.html" },
];

/** @type {FeatureMenuItem[]} */
const FEATURE_ITEMS = [
  {
    id: "f1",
    icon: "pitching",
    title: "AI 투구폼 분석",
    description: "투구 영상을 업로드하면 폼을 분석해드립니다.",
    href: "./pitching.html",
    accent: "navy",
  },
  {
    id: "f2",
    icon: "batting",
    title: "AI 타격폼 분석",
    description: "타격 영상을 업로드하면 스윙을 분석해드립니다.",
    href: "./batting.html",
    accent: "navy",
  },
  {
    id: "f3",
    icon: "highlight",
    title: "경기 하이라이트",
    description: "경기 영상을 분석해 주요 장면을 찾아드립니다.",
    href: "./highlight.html",
    accent: "navy",
  },
  {
    id: "f4",
    icon: "mypage",
    title: "마이페이지",
    description: "내 업로드 영상과 분석 기록을 관리합니다.",
    href: "./mypage.html",
    accent: "navy",
  },
];

/** @type {HowItWorksStep[]} */
const HOW_IT_WORKS_STEPS = [
  { step: 1, icon: "upload", title: "영상 업로드", description: "야구 영상을 업로드합니다." },
  { step: 2, icon: "analyze", title: "AI 분석", description: "최신 AI가 투구, 타격, 경기 장면을 분석합니다." },
  { step: 3, icon: "result", title: "결과 확인", description: "분석 리포트와 하이라이트를 확인합니다." },
];

window.BROS = window.BROS || {};
window.BROS.data = {
  NAV_ITEMS,
  FEATURE_ITEMS,
  HOW_IT_WORKS_STEPS,
};
