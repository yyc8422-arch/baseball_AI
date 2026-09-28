package com.bros.backend.mypage;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bros.backend.analysis.AiServerClient;
import com.bros.backend.analysis.AnalysisRecord;
import com.bros.backend.analysis.AnalysisRecordRepository;
import com.bros.backend.analysis.dto.AnalysisStatusResponse;
import com.bros.backend.common.ApiException;
import com.bros.backend.mypage.dto.AnalysisRecordView;
import com.bros.backend.mypage.dto.ReportSummaryView;

@Service
public class MyPageService {

    private static final Set<String> TERMINAL_STATUSES = Set.of("done", "failed");
    private static final DateTimeFormatter DISPLAY_FORMAT = DateTimeFormatter.ofPattern("yyyy.MM.dd HH:mm");
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy.MM.dd");
    /** 홈 리포트의 투수/타자 탭 순서 */
    private static final List<String> REPORT_TYPES = List.of("pitching", "batting");

    private final AnalysisRecordRepository analysisRecordRepository;
    private final AiServerClient aiServerClient;

    public MyPageService(AnalysisRecordRepository analysisRecordRepository, AiServerClient aiServerClient) {
        this.analysisRecordRepository = analysisRecordRepository;
        this.aiServerClient = aiServerClient;
    }

    @Transactional
    public List<AnalysisRecordView> getRecords(Long userId) {
        List<AnalysisRecord> records = analysisRecordRepository.findByUserIdOrderByCreatedAtDesc(userId);
        List<AnalysisRecordView> views = new ArrayList<>();
        boolean aiServerReachable = true;

        for (AnalysisRecord record : records) {
            // 진행 중인 건은 마이페이지를 열 때마다 AI-Server 에 최신 상태를 다시 물어봐서 캐시를 갱신합니다.
            // AI-Server 가 꺼져 있으면 마지막으로 저장된 상태를 그대로 보여줍니다 (목록 전체가 실패하지 않도록).
            if (aiServerReachable && !TERMINAL_STATUSES.contains(record.getStatus())) {
                try {
                    AnalysisStatusResponse latest = aiServerClient.getStatus(record.getVideoId(), false);
                    if (latest != null) {
                        record.setStatus(latest.getStatus());
                    }
                } catch (ApiException e) {
                    aiServerReachable = false; // 남은 기록마다 연결 타임아웃을 기다리지 않도록 이번 요청에서는 더 묻지 않음
                }
            }
            views.add(new AnalysisRecordView(
                    record.getVideoId(),
                    record.getFileName(),
                    record.getAnalysisType(),
                    record.getStatus(),
                    record.getCreatedAt().format(DISPLAY_FORMAT)
            ));
        }
        return views;
    }

    /**
     * 홈 "오늘의 AI 리포트": 투구/타격별 분석 수와 가장 최근 기록.
     * 최근 기록이 진행 중이면 상태를, 끝났으면 선수 검출 프레임 수를 AI-Server 에 물어보고,
     * AI-Server 가 꺼져 있으면 저장된 값만으로 응답합니다.
     */
    @Transactional
    public Map<String, ReportSummaryView> getReportSummary(Long userId) {
        Map<String, ReportSummaryView> result = new LinkedHashMap<>();
        boolean aiServerReachable = true;

        for (String type : REPORT_TYPES) {
            ReportSummaryView view = new ReportSummaryView(type, analysisRecordRepository.countByUserIdAndAnalysisType(userId, type));
            AnalysisRecord latest = analysisRecordRepository
                    .findFirstByUserIdAndAnalysisTypeOrderByCreatedAtDesc(userId, type).orElse(null);

            if (latest != null) {
                if (aiServerReachable) {
                    try {
                        AnalysisStatusResponse status = aiServerClient.getStatus(latest.getVideoId(), false);
                        if (status != null) {
                            latest.setStatus(status.getStatus());
                            if (status.getSummary() != null) {
                                view.setFrames(status.getSummary().getDetectedFrames(), status.getSummary().getAnalyzedFrames());
                            }
                        }
                    } catch (ApiException e) {
                        aiServerReachable = false;
                    }
                }
                view.setLatest(latest.getVideoId(), latest.getFileName(), latest.getStatus(),
                        latest.getCreatedAt().format(DATE_FORMAT));
            }
            result.put(type, view);
        }
        return result;
    }
}
