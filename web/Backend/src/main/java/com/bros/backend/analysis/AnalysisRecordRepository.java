package com.bros.backend.analysis;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AnalysisRecordRepository extends JpaRepository<AnalysisRecord, Long> {
    Optional<AnalysisRecord> findByVideoId(String videoId);

    List<AnalysisRecord> findByUserIdOrderByCreatedAtDesc(Long userId);
}
