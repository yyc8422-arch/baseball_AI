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

    /** 이전 분석 비교용: 같은 사용자·같은 종류·같은 촬영 방향에서 이 영상보다 먼저 올린, 결과가 DB 에 저장된 가장 최근 기록 */
    Optional<AnalysisRecord> findFirstByUserIdAndAnalysisTypeAndCameraViewAndReportJsonIsNotNullAndCreatedAtBeforeOrderByCreatedAtDesc(
            Long userId, String analysisType, String cameraView, java.time.LocalDateTime createdAt);
}
