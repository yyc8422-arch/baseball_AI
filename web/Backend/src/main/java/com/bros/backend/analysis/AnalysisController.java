package com.bros.backend.analysis;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.bros.backend.analysis.dto.AnalysisStatusResponse;
import com.bros.backend.analysis.dto.VideoUploadResponse;
import com.bros.backend.common.SessionUtils;

import jakarta.servlet.http.HttpSession;

/**
 * 프론트 js/analysis.js, js/capture.js 가 호출하는 영상 분석 API. 요청을 AI-Server(FastAPI)로 전달하고,
 * 누가 올렸는지·촬영 방향은 우리 DB 에 저장합니다. (로그인 필수 - WebMvcConfig)
 */
@RestController
@RequestMapping("/api/analysis")
public class AnalysisController {

    private final AnalysisService analysisService;

    public AnalysisController(AnalysisService analysisService) {
        this.analysisService = analysisService;
    }

    /** @param cameraView 촬영 방향 side / front / rear (생략하면 side) */
    @PostMapping
    public VideoUploadResponse upload(HttpSession session,
                                       @RequestParam("video") MultipartFile video,
                                       @RequestParam("analysisType") String analysisType,
                                       @RequestParam(value = "cameraView", required = false) String cameraView) {
        Long userId = SessionUtils.requireUserId(session);
        return analysisService.upload(userId, video, analysisType, cameraView);
    }

    /** 본인이 올린 영상만 조회 가능. 분석이 끝났으면 report.previousAnalysis 에 직전 분석 수치가 붙어 있음 */
    @GetMapping("/{videoId}")
    public AnalysisStatusResponse getStatus(HttpSession session, @PathVariable String videoId,
                                             @RequestParam(defaultValue = "false") boolean includePose) {
        Long userId = SessionUtils.requireUserId(session);
        return analysisService.getStatus(videoId, includePose, userId);
    }
}
