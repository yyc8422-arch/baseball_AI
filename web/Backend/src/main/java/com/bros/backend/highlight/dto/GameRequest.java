package com.bros.backend.highlight.dto;

/** 관리자 화면 경기 등록 요청 */
public class GameRequest {
    /** "2026-09-20" (input type=date 값 그대로) */
    private String gameDate;
    private String opponent;
    /** 표시 그대로의 점수 (예: "BROS 7 : 3") */
    private String score;

    public String getGameDate() {
        return gameDate;
    }

    public void setGameDate(String gameDate) {
        this.gameDate = gameDate;
    }

    public String getOpponent() {
        return opponent;
    }

    public void setOpponent(String opponent) {
        this.opponent = opponent;
    }

    public String getScore() {
        return score;
    }

    public void setScore(String score) {
        this.score = score;
    }
}
