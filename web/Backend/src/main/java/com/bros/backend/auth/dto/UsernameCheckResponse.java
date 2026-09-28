package com.bros.backend.auth.dto;

/** 프론트 auth.js 의 checkUsernameAvailability() 가 기대하는 "사용 가능 여부 + 안내문구" */
public class UsernameCheckResponse {
    private boolean available;
    private String message;

    public UsernameCheckResponse(boolean available, String message) {
        this.available = available;
        this.message = message;
    }

    public boolean isAvailable() {
        return available;
    }

    public String getMessage() {
        return message;
    }
}
