package com.bros.backend.auth.dto;

public class AuthMessageResponse {
    private String message;

    public AuthMessageResponse(String message) {
        this.message = message;
    }

    public String getMessage() {
        return message;
    }
}
