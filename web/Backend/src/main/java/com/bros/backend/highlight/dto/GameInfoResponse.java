package com.bros.backend.highlight.dto;

/** highlight.js 의 GameInfo 타입과 동일한 필드명(date/opponent/score) */
public class GameInfoResponse {
    private String date;
    private String opponent;
    private String score;

    public GameInfoResponse(String date, String opponent, String score) {
        this.date = date;
        this.opponent = opponent;
        this.score = score;
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
}
