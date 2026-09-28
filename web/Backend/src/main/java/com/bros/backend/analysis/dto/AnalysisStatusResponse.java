package com.bros.backend.analysis.dto;

import java.util.Map;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/** AI-Server 의 AnalysisStatusResponse 와 동일한 필드 구성 (GET /api/analysis/{video_id} 응답) */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AnalysisStatusResponse {
    private String videoId;
    private String fileName;
    private String analysisType;
    private String status;
    private String createdAt;
    private String updatedAt;
    private Double elapsedSec;
    private String error;
    private AnalysisSummary summary;
    private Map<String, Object> pose;

    public AnalysisStatusResponse() {
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

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Double getElapsedSec() {
        return elapsedSec;
    }

    public void setElapsedSec(Double elapsedSec) {
        this.elapsedSec = elapsedSec;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }

    public AnalysisSummary getSummary() {
        return summary;
    }

    public void setSummary(AnalysisSummary summary) {
        this.summary = summary;
    }

    public Map<String, Object> getPose() {
        return pose;
    }

    public void setPose(Map<String, Object> pose) {
        this.pose = pose;
    }
}
