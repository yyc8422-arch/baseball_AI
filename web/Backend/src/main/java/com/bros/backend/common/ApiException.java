package com.bros.backend.common;

import org.springframework.http.HttpStatus;

/**
 * 서비스 로직에서 발생하는 "클라이언트에 그대로 보여줄 수 있는" 예외.
 * GlobalExceptionHandler 가 { "detail": message } 형태로 응답합니다.
 * (프론트 js/analysis.js 의 readErrorMessage() 가 body.detail 을 읽는 것과 동일한 규약 - AI-Server 도 동일)
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
