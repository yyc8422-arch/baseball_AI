package com.bros.backend.analysis.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * AI-Server 의 AnalysisSummary(Pydantic) 와 1:1 대응.
 * @JsonNaming 으로 Java 는 camelCase 필드를 쓰면서 JSON 은 AI-Server/프론트와 동일한 snake_case 로 주고받습니다.
 * (예: detectedFrames <-> "detected_frames")
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AnalysisSummary {
    private Double fps;
    private Integer totalFrames;
    private Integer analyzedFrames;
    private Integer detectedFrames;

    public AnalysisSummary() {
    }

    public Double getFps() {
        return fps;
    }

    public void setFps(Double fps) {
        this.fps = fps;
    }

    public Integer getTotalFrames() {
        return totalFrames;
    }

    public void setTotalFrames(Integer totalFrames) {
        this.totalFrames = totalFrames;
    }

    public Integer getAnalyzedFrames() {
        return analyzedFrames;
    }

    public void setAnalyzedFrames(Integer analyzedFrames) {
        this.analyzedFrames = analyzedFrames;
    }

    public Integer getDetectedFrames() {
        return detectedFrames;
    }

    public void setDetectedFrames(Integer detectedFrames) {
        this.detectedFrames = detectedFrames;
    }
}
