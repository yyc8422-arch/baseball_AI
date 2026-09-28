package com.bros.backend.analysis;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AnalysisRecordRepository extends JpaRepository<AnalysisRecord, Long> {
    Optional<AnalysisRecord> findByVideoId(String videoId);

    List<AnalysisRecord> findByUserIdOrderByCreatedAtDesc(Long userId);

    /** 홈 "오늘의 AI 리포트": 분석 종류별 최근 기록 */
    Optional<AnalysisRecord> findFirstByUserIdAndAnalysisTypeOrderByCreatedAtDesc(Long userId, String analysisType);

    long countByUserIdAndAnalysisType(Long userId, String analysisType);
}
