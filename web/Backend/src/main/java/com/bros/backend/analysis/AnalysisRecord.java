package com.bros.backend.analysis;

import java.time.LocalDateTime;

import org.hibernate.annotations.ColumnDefault;

import com.bros.backend.user.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/**
 * AI-Server 가 관리하는 분석 결과(video_id 기준)를 "누가 언제 올렸는지" 우리 DB 에도 남겨서
 * 마이페이지(분석 기록/업로드한 영상)에서 조회할 수 있게 합니다.
 * 흐름: 프론트 → Spring → AI 서버(분석) → Spring → 이 테이블에 결과 저장 → 프론트.
 * 영상 파일과 프레임별 관절 좌표(pose)는 용량이 커서 AI 서버가 갖고, 측정 결과(report)는 여기에 저장합니다.
 */
@Entity
@Table(name = "analysis_records")
public class AnalysisRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** AI-Server 가 발급한 video_id. AI-Server 쪽 레코드와 이 값으로 매핑됩니다. */
    @Column(name = "video_id", nullable = false, unique = true, length = 100)
    private String videoId;

    /** 예전에 비로그인으로 올린 기록이 있을 수 있어 nullable (지금은 업로드가 로그인 필수) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "analysis_type", nullable = false, length = 20)
    private String analysisType;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    /** 촬영 방향 side / front / rear. 방향마다 측정할 수 있는 지표가 달라서, 이전 분석 비교도 같은 방향끼리만 함 */
    @ColumnDefault("'side'")
    @Column(name = "camera_view", nullable = false, length = 10)
    private String cameraView = "side";

    /** AI-Server 가 준 마지막 status 캐시 (queued/processing/done/failed) */
    @Column(nullable = false, length = 20)
    private String status;

    /**
     * 분석이 끝나면 Spring 이 AI 결과 리포트(videoInfo/phases/angles/movement/timing/speed/observations)를 JSON 으로 저장.
     * 이전 분석 비교는 이 값으로 하고, AI 서버에 결과가 없어져도 이 값으로 응답함.
     */
    @Column(name = "report_json", columnDefinition = "LONGTEXT")
    private String reportJson;

    /** 결과 요약(분석 프레임 등)도 같이 저장해서 AI 서버 없이도 영상 정보를 보여줄 수 있게 함 */
    @Column(name = "summary_json", columnDefinition = "TEXT")
    private String summaryJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected AnalysisRecord() {
    }

    public AnalysisRecord(String videoId, User user, String analysisType, String fileName, String status,
                          String cameraView) {
        this.videoId = videoId;
        this.user = user;
        this.analysisType = analysisType;
        this.fileName = fileName;
        this.status = status;
        this.cameraView = cameraView;
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public String getVideoId() {
        return videoId;
    }

    public User getUser() {
        return user;
    }

    public String getAnalysisType() {
        return analysisType;
    }

    public String getFileName() {
        return fileName;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getReportJson() {
        return reportJson;
    }

    public String getSummaryJson() {
        return summaryJson;
    }

    public void saveResult(String reportJson, String summaryJson) {
        this.reportJson = reportJson;
        this.summaryJson = summaryJson;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public String getCameraView() {
        return cameraView;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
