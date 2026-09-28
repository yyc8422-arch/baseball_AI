package com.bros.backend.mypage;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bros.backend.analysis.AiServerClient;
import com.bros.backend.analysis.AnalysisRecord;
import com.bros.backend.analysis.AnalysisRecordRepository;
import com.bros.backend.analysis.dto.AnalysisStatusResponse;
import com.bros.backend.common.ApiException;
import com.bros.backend.mypage.dto.AnalysisRecordView;

@Service
public class MyPageService {

    private static final Set<String> TERMINAL_STATUSES = Set.of("done", "failed");
    private static final DateTimeFormatter DISPLAY_FORMAT = DateTimeFormatter.ofPattern("yyyy.MM.dd HH:mm");

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
}
