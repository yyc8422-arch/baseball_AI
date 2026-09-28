package com.bros.backend.highlight;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface HighlightClipRepository extends JpaRepository<HighlightClip, Long> {
    List<HighlightClip> findByGameIdOrderByIdAsc(Long gameId);
}
