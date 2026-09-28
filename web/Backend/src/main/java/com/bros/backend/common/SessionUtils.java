package com.bros.backend.common;

import org.springframework.http.HttpStatus;

import jakarta.servlet.http.HttpSession;

public final class SessionUtils {

    private SessionUtils() {
    }

    /** 로그인 여부만 확인. 로그인 안 되어 있으면 null 반환 (업로드처럼 비로그인도 허용하는 API용) */
    public static Long currentUserId(HttpSession session) {
        if (session == null) return null;
        Object value = session.getAttribute(SessionKeys.USER_ID);
        return value == null ? null : (Long) value;
    }

    /** 로그인이 필수인 API(마이페이지 등)에서 사용. 비로그인이면 401 예외 발생 */
    public static Long requireUserId(HttpSession session) {
        Long userId = currentUserId(session);
        if (userId == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        }
        return userId;
    }
}
