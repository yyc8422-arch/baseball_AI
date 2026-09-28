package com.bros.backend.config;

import org.springframework.stereotype.Component;
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
