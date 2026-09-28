package com.bros.backend.auth.dto;

public class UserInfoResponse {
    private String username;
    private String name;
    /** USER / ADMIN - 프론트가 관리자에게만 "회원 승인 관리" 버튼을 보여줄 때 사용 */
    private String role;

    public UserInfoResponse(String username, String name, String role) {
        this.username = username;
        this.name = name;
        this.role = role;
    }

    public String getUsername() {
        return username;
    }

    public String getName() {
        return name;
    }

    public String getRole() {
        return role;
    }
}
