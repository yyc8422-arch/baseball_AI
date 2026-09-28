package com.bros.backend.mypage;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bros.backend.common.SessionUtils;
import com.bros.backend.mypage.dto.AnalysisRecordView;

import jakarta.servlet.http.HttpSession;

/**
 * mypage.html 은 현재 정적 빈 상태만 있고 이 API 를 아직 호출하지 않습니다.
 * "분석 기록" / "업로드한 영상" 두 empty-state 자리를 이 응답으로 채우는 JS 연동이 필요합니다.
 * (WebMvcConfig 에서 /api/mypage/** 전체가 로그인 필수로 막혀 있음 - 비로그인 호출 시 401 + {"detail":"로그인이 필요합니다."})
 */
@RestController
@RequestMapping("/api/mypage")
public class MyPageController {

    private final MyPageService myPageService;

    public MyPageController(MyPageService myPageService) {
        this.myPageService = myPageService;
    }

    @GetMapping("/analysis-records")
    public List<AnalysisRecordView> myAnalysisRecords(HttpSession session) {
        Long userId = SessionUtils.requireUserId(session);
        return myPageService.getRecords(userId);
    }
}
