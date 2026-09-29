package com.bros.backend.analysis.dto;

import java.util.Map;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * GET /api/analysis/{video_id} 응답. AI 서버의 응답과 같은 필드 구성이고, 프론트는 이 Spring 응답만 받습니다.
 * (프론트 → Spring → AI 서버 → Spring(결과 DB 저장, 이전 분석 비교 추가) → 프론트)
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AnalysisStatusResponse {
    private String videoId;
    private String fileName;
    private String analysisType;
    private String status;
    /** 촬영 방향 side / front / rear (AI-Server 가 안 주면 Spring 이 업로드 때 저장한 값으로 채움) */
    private String cameraView;
    private String createdAt;
    private String updatedAt;
    private Double elapsedSec;
    private String error;
    private AnalysisSummary summary;
    private Map<String, Object> pose;
    /**
     * AI 분석 결과 리포트 (videoInfo, phases, angles, movement, timing, speed, observations). 형식은 프론트 js/types.js 의 AnalysisReport.
     * Spring 이 DB(analysis_records.report_json)에 저장하고, previousAnalysis(같은 사용자의 직전 분석, DB 에서)를 붙여서 전달.
     */
    private Map<String, Object> report;

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

    public String getCameraView() {
        return cameraView;
    }

    public void setCameraView(String cameraView) {
        this.cameraView = cameraView;
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

    public Map<String, Object> getReport() {
        return report;
    }

    public void setReport(Map<String, Object> report) {
        this.report = report;
    }
}
