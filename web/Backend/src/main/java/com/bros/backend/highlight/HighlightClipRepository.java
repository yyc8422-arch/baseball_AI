package com.bros.backend.highlight;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface HighlightClipRepository extends JpaRepository<HighlightClip, Long> {
    List<HighlightClip> findByGameIdOrderByIdAsc(Long gameId);

    long countByGameId(Long gameId);

    /** 경기를 지울 때 그 경기의 장면도 함께 삭제 */
    void deleteByGameId(Long gameId);
}
