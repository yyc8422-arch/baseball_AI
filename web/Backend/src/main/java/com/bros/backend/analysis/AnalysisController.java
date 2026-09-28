package com.bros.backend.analysis;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.bros.backend.analysis.dto.AnalysisStatusResponse;
import com.bros.backend.analysis.dto.VideoUploadResponse;
import com.bros.backend.common.ApiException;
import com.bros.backend.common.SessionUtils;

import jakarta.servlet.http.HttpSession;

/**
 * 프론트 js/analysis.js, js/capture.js 가 호출하는 API_BASE_URL 을 AI-Server(8000) 대신
 * 이 Spring 서버(기본 8080)로 바꾸면 그대로 붙습니다. 요청/응답 형태(JSON 필드명 포함)를 동일하게 맞췄습니다.
 *
 * 비로그인 사용자도 업로드/조회는 가능하지만(현재 프론트 UX 유지), 로그인 상태면 자동으로
 * 그 사용자 소유로 기록되어 마이페이지에 나타납니다.
 */
@RestController
@RequestMapping("/api/analysis")
public class AnalysisController {

    private final AnalysisService analysisService;

    public AnalysisController(AnalysisService analysisService) {
        this.analysisService = analysisService;
    }

    @PostMapping
    public VideoUploadResponse upload(HttpSession session,
                                       @RequestParam("video") MultipartFile video,
                                       @RequestParam("analysisType") String analysisType) {
        Long userId = SessionUtils.currentUserId(session);
        return analysisService.upload(userId, video, analysisType);
    }

    @GetMapping("/{videoId}")
    public AnalysisStatusResponse getStatus(@PathVariable String videoId,
                                             @RequestParam(defaultValue = "false") boolean includePose) {
        AnalysisStatusResponse result = analysisService.getStatus(videoId, includePose);
        if (result == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "분석 기록을 찾을 수 없습니다.");
        }
        return result;
    }
}
