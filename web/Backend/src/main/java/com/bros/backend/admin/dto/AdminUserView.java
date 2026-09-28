package com.bros.backend.admin.dto;

/** 관리자 화면(admin.html)의 회원 목록 한 줄 */
public class AdminUserView {
    private Long id;
    private String username;
    private String name;
    private String status;
    private String role;
    private String createdAt;
    private String reviewedAt;

    public AdminUserView(Long id, String username, String name, String status, String role,
                         String createdAt, String reviewedAt) {
        this.id = id;
        this.username = username;
        this.name = name;
        this.status = status;
        this.role = role;
        this.createdAt = createdAt;
        this.reviewedAt = reviewedAt;
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getName() {
        return name;
    }

    public String getStatus() {
        return status;
    }

    public String getRole() {
        return role;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public String getReviewedAt() {
        return reviewedAt;
    }
}
