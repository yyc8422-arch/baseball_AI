package com.bros.backend.analysis.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * AI-Server 의 VideoUploadResponse 와 동일한 필드 구성.
 * 이 클래스는 두 군데에서 재사용됩니다:
 *  1) AiServerClient 가 AI-Server 응답을 역직렬화할 때
 *  2) AnalysisController 가 프론트(analysis.js)로 그대로 내려줄 때
 * 덕분에 프론트 코드(analysis.js)는 API 주소만 Spring 쪽으로 바꾸면 되고 응답 파싱 로직은 그대로 씁니다.
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class VideoUploadResponse {
    private String videoId;
    private String fileName;
    private Long fileSizeBytes;
    private String analysisType;
    private String status;

    public VideoUploadResponse() {
    }

    public String getVideoId() {
        return videoId;
    }

    public void setVideoId(String videoId) {
        this.videoId = videoId;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public Long getFileSizeBytes() {
        return fileSizeBytes;
    }

    public void setFileSizeBytes(Long fileSizeBytes) {
        this.fileSizeBytes = fileSizeBytes;
    }

    public String getAnalysisType() {
        return analysisType;
    }

    public void setAnalysisType(String analysisType) {
        this.analysisType = analysisType;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
