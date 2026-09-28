package com.bros.backend.analysis;

import java.time.LocalDateTime;

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
 * 실제 분석 상태/영상 파일 자체는 여전히 AI-Server 가 갖고 있고, 여긴 매핑 + 캐시된 상태만 저장합니다.
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

    /** 로그인하지 않고 올린 경우도 허용하므로 nullable */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "analysis_type", nullable = false, length = 20)
    private String analysisType;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    /** AI-Server 가 준 마지막 status 캐시 (queued/processing/done/failed) */
    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected AnalysisRecord() {
    }

    public AnalysisRecord(String videoId, User user, String analysisType, String fileName, String status) {
        this.videoId = videoId;
        this.user = user;
        this.analysisType = analysisType;
        this.fileName = fileName;
        this.status = status;
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

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
