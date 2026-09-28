package com.bros.backend.highlight;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GameRepository extends JpaRepository<Game, Long> {
    Optional<Game> findTopByOrderByGameDateDescIdDesc();

    /** 관리자 화면 경기 목록 (최근 경기부터) */
    List<Game> findAllByOrderByGameDateDescIdDesc();
}
