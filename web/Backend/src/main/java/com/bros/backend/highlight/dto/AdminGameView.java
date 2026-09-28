package com.bros.backend.highlight.dto;

/** 관리자 화면 경기 목록 한 줄 */
public class AdminGameView {
    private Long id;
    private String date;
    private String opponent;
    private String score;
    private long clipCount;
    /** 하이라이트 페이지에 지금 보이는 경기(가장 최근 경기)인지 */
    private boolean showing;

    public AdminGameView(Long id, String date, String opponent, String score, long clipCount, boolean showing) {
        this.id = id;
        this.date = date;
        this.opponent = opponent;
        this.score = score;
        this.clipCount = clipCount;
        this.showing = showing;
    }

    public Long getId() {
        return id;
    }

    public String getDate() {
        return date;
    }

    public String getOpponent() {
        return opponent;
    }

    public String getScore() {
        return score;
    }

    public long getClipCount() {
        return clipCount;
    }

    public boolean isShowing() {
        return showing;
    }
}
