package com.bros.backend.highlight;

import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** highlight.html 상단 "경기 정보"(GAME_INFO 목데이터)에 대응하는 실제 경기 1건 */
@Entity
@Table(name = "games")
public class Game {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "game_date", nullable = false)
    private LocalDate gameDate;

    @Column(nullable = false, length = 100)
    private String opponent;

    /** 프론트 표시 그대로("BROS 7 : 3") 문자열로 저장 - 계산이 필요 없어 단순하게 유지 */
    @Column(nullable = false, length = 50)
    private String score;

    protected Game() {
    }

    public Game(LocalDate gameDate, String opponent, String score) {
        this.gameDate = gameDate;
        this.opponent = opponent;
        this.score = score;
    }

    public Long getId() {
        return id;
    }

    public LocalDate getGameDate() {
        return gameDate;
    }

    public String getOpponent() {
        return opponent;
    }

    public String getScore() {
        return score;
    }
}
