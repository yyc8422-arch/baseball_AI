package com.bros.backend.auth;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.bros.backend.auth.dto.AuthMessageResponse;
import com.bros.backend.auth.dto.LoginRequest;
import com.bros.backend.auth.dto.SignupRequest;
import com.bros.backend.auth.dto.UserInfoResponse;
import com.bros.backend.auth.dto.UsernameCheckResponse;
import com.bros.backend.common.ApiException;
import com.bros.backend.common.SessionKeys;
import com.bros.backend.common.SessionUtils;
import com.bros.backend.user.User;
import com.bros.backend.user.UserStatus;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

/** 프론트 js/auth.js(로그인/회원가입/아이디 중복확인)와 js/shell.js(로그아웃, 로그인 상태 확인)가 호출하는 컨트롤러. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping("/check-username")
    public UsernameCheckResponse checkUsername(@RequestParam String username) {
        return authService.checkUsername(username);
    }

    @PostMapping("/signup")
    public AuthMessageResponse signup(@RequestBody SignupRequest req) {
        authService.signup(req);
        return new AuthMessageResponse("가입 신청이 완료되었습니다. 관리자 승인 후 로그인하실 수 있습니다.");
    }

    @PostMapping("/login")
    public UserInfoResponse login(@RequestBody LoginRequest req, HttpServletRequest request) {
        User user = authService.login(req);

        // 로그인 전에 쓰던 세션이 있으면 버리고 새로 발급 (세션 고정 공격 방지)
        HttpSession oldSession = request.getSession(false);
        if (oldSession != null) {
            oldSession.invalidate();
        }
        HttpSession session = request.getSession(true);
        session.setAttribute(SessionKeys.USER_ID, user.getId());
        session.setAttribute(SessionKeys.USERNAME, user.getUsername());

        return new UserInfoResponse(user.getUsername(), user.getName(), user.getRole().name());
    }

    @PostMapping("/logout")
    public AuthMessageResponse logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        return new AuthMessageResponse("로그아웃되었습니다.");
    }

    /** 새로고침 후에도 로그인 상태/이름을 프론트가 확인할 수 있도록 제공 */
    @GetMapping("/me")
    public UserInfoResponse me(HttpSession session) {
        Long userId = SessionUtils.requireUserId(session);
        User user = authService.getUserOrThrow(userId);
        if (user.getStatus() != UserStatus.APPROVED) {
            // 로그인한 뒤에 관리자가 거절로 바꾼 경우 세션을 끊음
            session.invalidate();
            throw new ApiException(HttpStatus.FORBIDDEN, "가입이 승인되지 않았습니다. 관리자에게 문의해주세요.");
        }
        return new UserInfoResponse(user.getUsername(), user.getName(), user.getRole().name());
    }
}
