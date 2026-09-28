package com.bros.backend.highlight;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** highlight.js 의 HighlightClip 타입(MOCK_HIGHLIGHTS)과 1:1 대응하는 실제 하이라이트 클립 */
@Entity
@Table(name = "highlight_clips")
public class HighlightClip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "game_id", nullable = false)
    private Game game;

    /** "P","C","1B"... 포지션별 하이라이트 분류 기준. 타격/전체 장면처럼 포지션이 없으면 null */
    @Column(length = 4)
    private String position;

    /** "batting" | "defense" | "highlight" */
    @Column(nullable = false, length = 20)
    private String category;

    /** 장면 종류 코드 (예: "ground_ball", "throw", "home_run") */
    @Column(nullable = false, length = 50)
    private String action;

    @Column(name = "action_label", nullable = false, length = 100)
    private String actionLabel;

    /** 영상 내 시간 위치 "HH:MM:SS". SQL 예약어 충돌을 피하려고 컬럼명은 timestamp_label 로 둠 */
    @Column(name = "timestamp_label", nullable = false, length = 20)
    private String timestampLabel;

    @Column(name = "clip_url", length = 500)
    private String clipUrl;

    @Column(name = "thumbnail_url", length = 500)
    private String thumbnailUrl;

    protected HighlightClip() {
    }

    public HighlightClip(Game game, String position, String category, String action,
                          String actionLabel, String timestampLabel, String clipUrl, String thumbnailUrl) {
        this.game = game;
        this.position = position;
        this.category = category;
        this.action = action;
        this.actionLabel = actionLabel;
        this.timestampLabel = timestampLabel;
        this.clipUrl = clipUrl;
        this.thumbnailUrl = thumbnailUrl;
    }

    public Long getId() {
        return id;
    }

    public Game getGame() {
        return game;
    }

    public String getPosition() {
        return position;
    }

    public String getCategory() {
        return category;
    }

    public String getAction() {
        return action;
    }

    public String getActionLabel() {
        return actionLabel;
    }

    public String getTimestampLabel() {
        return timestampLabel;
    }

    public String getClipUrl() {
        return clipUrl;
    }

    public String getThumbnailUrl() {
        return thumbnailUrl;
    }
}
