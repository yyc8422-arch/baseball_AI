package com.bros.backend.highlight;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GameRepository extends JpaRepository<Game, Long> {
    Optional<Game> findTopByOrderByGameDateDescIdDesc();
}
