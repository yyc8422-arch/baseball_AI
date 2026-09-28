package com.bros.backend.mypage.dto;

/** 마이페이지 "분석 기록" / "업로드한 영상" 목록 한 줄. 두 섹션이 같은 데이터를 다르게 보여줄 뿐이라 하나로 통일했습니다. */
public class AnalysisRecordView {
    private String videoId;
    private String fileName;
    private String analysisType;
    private String status;
    private String createdAt;

    public AnalysisRecordView(String videoId, String fileName, String analysisType, String status, String createdAt) {
        this.videoId = videoId;
        this.fileName = fileName;
        this.analysisType = analysisType;
        this.status = status;
        this.createdAt = createdAt;
    }

    public String getVideoId() {
        return videoId;
    }

    public String getFileName() {
        return fileName;
    }

    public String getAnalysisType() {
        return analysisType;
    }

    public String getStatus() {
        return status;
    }

    public String getCreatedAt() {
        return createdAt;
    }
}
