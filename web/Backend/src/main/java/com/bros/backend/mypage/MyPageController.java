package com.bros.backend.mypage;

import java.time.Duration;
import java.util.List;

import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.bros.backend.auth.dto.AuthMessageResponse;
import com.bros.backend.common.SessionUtils;
import com.bros.backend.mypage.dto.AnalysisRecordView;

import jakarta.servlet.http.HttpSession;

/**
 * 마이페이지(js/mypage.js)용 API: 분석 기록 목록, 프로필 사진.
 * (WebMvcConfig 에서 /api/mypage/** 전체가 로그인 필수로 막혀 있음 - 비로그인 호출 시 401 + {"detail":"로그인이 필요합니다."})
 */
@RestController
@RequestMapping("/api/mypage")
public class MyPageController {

    private final MyPageService myPageService;
    private final ProfileImageService profileImageService;

    public MyPageController(MyPageService myPageService, ProfileImageService profileImageService) {
        this.myPageService = myPageService;
        this.profileImageService = profileImageService;
    }

    @GetMapping("/analysis-records")
    public List<AnalysisRecordView> myAnalysisRecords(HttpSession session) {
        Long userId = SessionUtils.requireUserId(session);
        return myPageService.getRecords(userId);
    }

    /** 내 프로필 사진 (img src 로 바로 사용). 주소에 붙는 ?v= 는 사진이 바뀔 때마다 달라져서 오래 캐시해도 됨 */
    @GetMapping("/profile-image")
    public ResponseEntity<Resource> profileImage(HttpSession session) {
        Long userId = SessionUtils.requireUserId(session);
        Resource image = profileImageService.load(userId);
        return ResponseEntity.ok()
                .contentType(ProfileImageService.mediaTypeOf(image.getFilename()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePrivate())
                .header("X-Content-Type-Options", "nosniff")
                .body(image);
    }

    /** 프로필 사진 등록/변경 (multipart: image) */
    @PostMapping("/profile-image")
    public AuthMessageResponse uploadProfileImage(HttpSession session, @RequestParam("image") MultipartFile image) {
        Long userId = SessionUtils.requireUserId(session);
        profileImageService.save(userId, image);
        return new AuthMessageResponse("프로필 사진이 변경되었습니다.");
    }

    @DeleteMapping("/profile-image")
    public AuthMessageResponse deleteProfileImage(HttpSession session) {
        Long userId = SessionUtils.requireUserId(session);
        profileImageService.delete(userId);
        return new AuthMessageResponse("프로필 사진을 삭제했습니다.");
    }
}
