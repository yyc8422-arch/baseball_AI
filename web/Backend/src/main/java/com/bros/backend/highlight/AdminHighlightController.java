package com.bros.backend.highlight;

import java.util.List;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bros.backend.admin.AdminService;
import com.bros.backend.auth.dto.AuthMessageResponse;
import com.bros.backend.highlight.dto.AdminGameView;
import com.bros.backend.highlight.dto.ClipRequest;
import com.bros.backend.highlight.dto.GameRequest;
import com.bros.backend.highlight.dto.HighlightClipResponse;

import jakarta.servlet.http.HttpSession;

/**
 * 하이라이트 관리 (프론트 admin.html 의 "하이라이트 관리" 탭, 관리자 전용).
 * /api/admin/** 는 WebMvcConfig 에서 로그인 필수로 막혀 있고, 여기서 한 번 더 관리자인지 확인합니다.
 */
@RestController
@RequestMapping("/api/admin/highlights")
public class AdminHighlightController {

    private final AdminService adminService;
    private final AdminHighlightService highlightService;

    public AdminHighlightController(AdminService adminService, AdminHighlightService highlightService) {
        this.adminService = adminService;
        this.highlightService = highlightService;
    }

    @GetMapping("/games")
    public List<AdminGameView> games(HttpSession session) {
        adminService.requireAdmin(session);
        return highlightService.listGames();
    }

    @PostMapping("/games")
    public AuthMessageResponse createGame(HttpSession session, @RequestBody GameRequest req) {
        adminService.requireAdmin(session);
        highlightService.createGame(req);
        return new AuthMessageResponse("경기를 등록했습니다.");
    }

    @DeleteMapping("/games/{id}")
    public AuthMessageResponse deleteGame(HttpSession session, @PathVariable Long id) {
        adminService.requireAdmin(session);
        highlightService.deleteGame(id);
        return new AuthMessageResponse("경기와 장면을 삭제했습니다.");
    }

    @GetMapping("/games/{id}/clips")
    public List<HighlightClipResponse> clips(HttpSession session, @PathVariable Long id) {
        adminService.requireAdmin(session);
        return highlightService.listClips(id);
    }

    @PostMapping("/games/{id}/clips")
    public AuthMessageResponse addClip(HttpSession session, @PathVariable Long id, @RequestBody ClipRequest req) {
        adminService.requireAdmin(session);
        highlightService.addClip(id, req);
        return new AuthMessageResponse("장면을 추가했습니다.");
    }

    @DeleteMapping("/clips/{id}")
    public AuthMessageResponse deleteClip(HttpSession session, @PathVariable Long id) {
        adminService.requireAdmin(session);
        highlightService.deleteClip(id);
        return new AuthMessageResponse("장면을 삭제했습니다.");
    }
}
