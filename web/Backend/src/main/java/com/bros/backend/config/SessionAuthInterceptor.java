package com.bros.backend.config;

import org.springframework.stereotype.Component;
import org.springframework.web.cors.CorsUtils;
import org.springframework.web.servlet.HandlerInterceptor;

import com.bros.backend.common.SessionKeys;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

/**
 * 세션에 로그인 정보가 없으면 401 로 막는 인터셉터.
 * WebMvcConfig 에서 /api/mypage/** 등 "로그인 필수" 경로에만 적용합니다.
 */
@Component
public class SessionAuthInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // DELETE 등을 보내기 전에 브라우저가 쿠키 없이 먼저 보내는 CORS 사전 확인(OPTIONS)은 통과시켜야
        // 실제 요청이 나갈 수 있음 (막으면 브라우저가 CORS 에러로 요청 자체를 취소함)
        if (CorsUtils.isPreFlightRequest(request)) {
            return true;
        }
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute(SessionKeys.USER_ID) == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"detail\":\"로그인이 필요합니다.\"}");
            return false;
        }
        return true;
    }
}
