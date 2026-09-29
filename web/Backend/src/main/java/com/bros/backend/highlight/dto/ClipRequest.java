package com.bros.backend.highlight.dto;

/** 관리자 화면 하이라이트 장면 추가 요청 */
public class ClipRequest {
    /** "batting" | "defense" | "highlight" */
    private String category;
    /** 장면 이름 (예: "5회 솔로 홈런") */
    private String actionLabel;
    /** 경기 영상 속 시간 "HH:MM:SS" */
    private String timestamp;
    /** 장면 영상 주소 (선택, http/https 만) */
    private String clipUrl;

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getActionLabel() {
        return actionLabel;
    }

    public void setActionLabel(String actionLabel) {
        this.actionLabel = actionLabel;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public String getClipUrl() {
        return clipUrl;
    }

    public void setClipUrl(String clipUrl) {
        this.clipUrl = clipUrl;
    }
}
