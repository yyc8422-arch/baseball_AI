package com.bros.backend.mypage.dto;

/**
 * 홈 "오늘의 AI 리포트" 카드 한 종류(투구 또는 타격)의 요약.
 * 자세 평가(종합 상태, 개선 포인트, 코멘트)는 AI-Server 에 아직 없어서, 지금은 실제로 있는 값(분석 수, 최근 영상, 상태)만 내려줍니다.
 */
public class ReportSummaryView {
    private String analysisType;
    private long totalCount;
    /** 아래 latest* 값은 분석 기록이 하나도 없으면 null */
    private String latestVideoId;
    private String latestFileName;
    private String latestStatus;
    private String latestDate;
    /** 최근 분석이 끝났고 AI-Server 에서 받아온 경우에만 값이 있음 */
    private Integer detectedFrames;
    private Integer analyzedFrames;

    public ReportSummaryView(String analysisType, long totalCount) {
        this.analysisType = analysisType;
        this.totalCount = totalCount;
    }

    public void setLatest(String videoId, String fileName, String status, String date) {
        this.latestVideoId = videoId;
        this.latestFileName = fileName;
        this.latestStatus = status;
        this.latestDate = date;
    }

    public void setFrames(Integer detectedFrames, Integer analyzedFrames) {
        this.detectedFrames = detectedFrames;
        this.analyzedFrames = analyzedFrames;
    }

    public String getAnalysisType() {
        return analysisType;
    }

    public long getTotalCount() {
        return totalCount;
    }

    public String getLatestVideoId() {
        return latestVideoId;
    }

    public String getLatestFileName() {
        return latestFileName;
    }

    public String getLatestStatus() {
        return latestStatus;
    }

    public String getLatestDate() {
        return latestDate;
    }

    public Integer getDetectedFrames() {
        return detectedFrames;
    }

    public Integer getAnalyzedFrames() {
        return analyzedFrames;
    }
}
