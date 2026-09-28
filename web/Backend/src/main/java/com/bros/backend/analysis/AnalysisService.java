package com.bros.backend.analysis;

import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.bros.backend.analysis.dto.AnalysisStatusResponse;
import com.bros.backend.analysis.dto.VideoUploadResponse;
import com.bros.backend.common.ApiException;
import com.bros.backend.user.User;
import com.bros.backend.user.UserRepository;

@Service
public class AnalysisService {

    private static final Set<String> ALLOWED_TYPES = Set.of("pitching", "batting", "highlight");

    private final AiServerClient aiServerClient;
    private final AnalysisRecordRepository analysisRecordRepository;
    private final UserRepository userRepository;

    public AnalysisService(AiServerClient aiServerClient,
                            AnalysisRecordRepository analysisRecordRepository,
                            UserRepository userRepository) {
        this.aiServerClient = aiServerClient;
        this.analysisRecordRepository = analysisRecordRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public VideoUploadResponse upload(Long userId, MultipartFile video, String analysisType) {
        if (video == null || video.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "영상 파일이 비어 있습니다.");
        }
        if (analysisType == null || !ALLOWED_TYPES.contains(analysisType)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "analysisType 은 pitching/batting/highlight 중 하나여야 합니다.");
        }

        // 1) AI-Server 로 그대로 전달 (실제 저장/분석 큐잉은 AI-Server 가 담당)
        VideoUploadResponse result = aiServerClient.upload(video, analysisType);

        // 2) 우리 DB 에는 "누가 언제 뭘 올렸는지" 매핑만 저장 (마이페이지 조회용)
        User user = userId != null ? userRepository.findById(userId).orElse(null) : null;
        AnalysisRecord record = new AnalysisRecord(
                result.getVideoId(), user, result.getAnalysisType(), result.getFileName(), result.getStatus());
        analysisRecordRepository.save(record);

        return result;
    }

    public AnalysisStatusResponse getStatus(String videoId, boolean includePose) {
        AnalysisStatusResponse result = aiServerClient.getStatus(videoId, includePose);
        if (result != null) {
            // 마이페이지에서 매번 AI-Server 를 다시 조회하지 않도록 최신 status 를 캐시해 둡니다.
            analysisRecordRepository.findByVideoId(videoId).ifPresent(record -> {
                record.setStatus(result.getStatus());
                analysisRecordRepository.save(record);
            });
        }
        return result;
    }
}
