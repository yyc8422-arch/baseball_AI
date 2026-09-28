package com.bros.backend.common;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.client.HttpStatusCodeException;

/**
 * 모든 컨트롤러의 예외를 { "detail": "설명" } 형태로 통일해서 응답합니다.
 * 프론트(analysis.js / auth.js)가 실패 메시지를 res.json().detail 로 읽으므로 형태를 반드시 유지해야 합니다.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, String>> handleApiException(ApiException e) {
        return ResponseEntity.status(e.getStatus()).body(Map.of("detail", e.getMessage()));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> handleMaxUploadSize(MaxUploadSizeExceededException e) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(Map.of("detail", "영상 파일이 너무 큽니다."));
    }

    /** AI-Server 가 4xx/5xx 를 내려줬는데 AiServerClient 에서 별도 처리하지 않은 경우의 최후 보루 */
    @ExceptionHandler(HttpStatusCodeException.class)
    public ResponseEntity<Map<String, String>> handleAiServerError(HttpStatusCodeException e) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(Map.of("detail", "AI 서버 처리 중 오류가 발생했습니다."));
    }

    /** 없는 주소 호출 - 아래 Exception 처리에 걸려 500 이 되지 않도록 404 로 돌려줌 */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, String>> handleNotFound(NoResourceFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("detail", "요청한 API 를 찾을 수 없습니다. 백엔드 서버가 최신 코드로 실행 중인지 확인해주세요."));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Map<String, String>> handleMethodNotAllowed(HttpRequestMethodNotSupportedException e) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(Map.of("detail", "지원하지 않는 요청 방식입니다."));
    }

    /** JSON 형식 오류, 필수 파라미터 누락, 숫자 자리에 문자 등 - 클라이언트 요청 문제라 400 */
    @ExceptionHandler({HttpMessageNotReadableException.class, MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Map<String, String>> handleBadRequest(Exception e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("detail", "요청 형식이 올바르지 않습니다."));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleUnexpected(Exception e) {
        e.printStackTrace();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("detail", "서버 오류가 발생했습니다."));
    }
}
