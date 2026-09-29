package com.bros.backend.analysis;

import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.bros.backend.analysis.dto.AnalysisStatusResponse;
import com.bros.backend.analysis.dto.AnalysisSummary;
import com.bros.backend.analysis.dto.VideoUploadResponse;
import com.bros.backend.common.ApiException;
import com.bros.backend.user.User;
import com.bros.backend.user.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * 영상 분석 흐름: 프론트 → Spring(여기) → AI 서버(Python, 분석) → Spring(결과 DB 저장 + 이전 분석 비교 추가) → 프론트.
 * 프론트는 AI 서버와 직접 통신하지 않습니다.
 */
@Service
public class AnalysisService {

    private static final Set<String> ALLOWED_TYPES = Set.of("pitching", "batting", "highlight");
    private static final Set<String> CAMERA_VIEWS = Set.of("side", "front", "rear");
    private static final String DEFAULT_CAMERA_VIEW = "side";
    /** 이전 분석 비교에 넣는 카테고리 (관절 및 자세 / 움직임 / 동작 타이밍 / 동작 속도) — 화면에서 같은 카테고리·같은 단위끼리 비교 */
    private static final List<String> COMPARE_CATEGORIES = List.of("angles", "movement", "timing", "speed");
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy.MM.dd");
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<Map<String, Object>>() {
    };

    private final AiServerClient aiServerClient;
    private final AnalysisRecordRepository analysisRecordRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    public AnalysisService(AiServerClient aiServerClient,
                            AnalysisRecordRepository analysisRecordRepository,
                            UserRepository userRepository,
                            ObjectMapper objectMapper) {
        this.aiServerClient = aiServerClient;
        this.analysisRecordRepository = analysisRecordRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public VideoUploadResponse upload(Long userId, MultipartFile video, String analysisType, String cameraView) {
        if (video == null || video.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "영상 파일이 비어 있습니다.");
        }
        if (analysisType == null || !ALLOWED_TYPES.contains(analysisType)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "analysisType 은 pitching/batting/highlight 중 하나여야 합니다.");
        }
        String view = cameraView == null || cameraView.isBlank() ? DEFAULT_CAMERA_VIEW : cameraView;
        if (!CAMERA_VIEWS.contains(view)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "cameraView 는 side/front/rear 중 하나여야 합니다.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));

        // 1) AI 서버로 그대로 전달 (실제 저장/분석 큐잉은 AI 서버가 담당)
        VideoUploadResponse result = aiServerClient.upload(video, analysisType, view);

        // 2) 우리 DB 에 "누가 언제 뭘 어떤 방향으로 찍어 올렸는지" 저장 (결과는 분석이 끝나면 getStatus 에서 저장)
        AnalysisRecord record = new AnalysisRecord(
                result.getVideoId(), user, result.getAnalysisType(), result.getFileName(), result.getStatus(), view);
        analysisRecordRepository.save(record);

        return result;
    }

    /**
     * 분석 상태/결과 조회. 본인이 올린 영상만 볼 수 있음 (다른 사람 영상이면 있는지도 알 수 없게 404).
     * AI 서버에서 상태/결과를 받아 → 분석이 끝났으면 결과(report, summary)를 DB 에 저장 →
     * 같은 사용자·같은 종류·같은 촬영 방향의 직전 분석 결과(DB)를 report.previousAnalysis 로 붙여서 전달.
     * AI 서버에 결과가 없거나 연결이 안 돼도, DB 에 저장된 결과가 있으면 그걸로 응답합니다.
     */
    @Transactional
    public AnalysisStatusResponse getStatus(String videoId, boolean includePose, Long userId) {
        AnalysisRecord record = analysisRecordRepository.findByVideoId(videoId)
                .filter(r -> r.getUser() != null && r.getUser().getId().equals(userId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "분석 기록을 찾을 수 없습니다."));

        AnalysisStatusResponse result;
        try {
            result = aiServerClient.getStatus(videoId, includePose);
        } catch (ApiException e) {
            if (record.getReportJson() == null) {
                throw e; // 저장된 결과도 없으면 AI 서버 연결 오류 그대로
            }
            result = null;
        }
        if (result == null) {
            result = fromSavedResult(record);
            if (result == null) {
                throw new ApiException(HttpStatus.NOT_FOUND, "분석 기록을 찾을 수 없습니다.");
            }
        }

        // 마이페이지에서 매번 AI 서버를 다시 조회하지 않도록 최신 status 를 캐시
        record.setStatus(result.getStatus());
        if (result.getCameraView() == null) {
            result.setCameraView(record.getCameraView());
        }
        if ("done".equals(result.getStatus()) && result.getReport() != null && record.getReportJson() == null) {
            record.saveResult(toJson(result.getReport()), toJson(result.getSummary()));
        }
        attachPreviousAnalysis(record, result);
        return result;
    }

    /** DB 에 저장된 결과로 응답 만들기 (프레임별 관절 좌표 pose 는 용량이 커서 AI 서버에만 있으므로 빠짐) */
    private AnalysisStatusResponse fromSavedResult(AnalysisRecord record) {
        if (record.getReportJson() == null) {
            return null;
        }
        AnalysisStatusResponse saved = new AnalysisStatusResponse();
        saved.setVideoId(record.getVideoId());
        saved.setFileName(record.getFileName());
        saved.setAnalysisType(record.getAnalysisType());
        saved.setStatus("done");
        saved.setCameraView(record.getCameraView());
        saved.setCreatedAt(record.getCreatedAt().toString());
        saved.setUpdatedAt(record.getUpdatedAt().toString());
        saved.setReport(fromJson(record.getReportJson(), MAP_TYPE));
        if (record.getSummaryJson() != null) {
            saved.setSummary(fromJson(record.getSummaryJson(), new TypeReference<AnalysisSummary>() {
            }));
        }
        return saved;
    }

    private void attachPreviousAnalysis(AnalysisRecord record, AnalysisStatusResponse result) {
        Map<String, Object> report = result.getReport();
        if (!"done".equals(result.getStatus()) || report == null || report.containsKey("previousAnalysis")) {
            return;
        }
        AnalysisRecord previous = analysisRecordRepository
                .findFirstByUserIdAndAnalysisTypeAndCameraViewAndReportJsonIsNotNullAndCreatedAtBeforeOrderByCreatedAtDesc(
                        record.getUser().getId(), record.getAnalysisType(), record.getCameraView(), record.getCreatedAt())
                .orElse(null);
        if (previous == null) {
            return;
        }
        Map<String, Object> previousReport = fromJson(previous.getReportJson(), MAP_TYPE);
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("analyzedAt", previous.getCreatedAt().format(DATE_FORMAT));
        summary.put("fileName", previous.getFileName());
        summary.put("cameraView", previous.getCameraView());
        for (String category : COMPARE_CATEGORIES) {
            if (previousReport.get(category) != null) {
                summary.put(category, previousReport.get(category));
            }
        }
        report.put("previousAnalysis", summary);
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "분석 결과를 저장하지 못했습니다.");
        }
    }

    private <T> T fromJson(String json, TypeReference<T> type) {
        try {
            return objectMapper.readValue(json, type);
        } catch (JsonProcessingException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "저장된 분석 결과를 읽지 못했습니다.");
        }
    }
}
