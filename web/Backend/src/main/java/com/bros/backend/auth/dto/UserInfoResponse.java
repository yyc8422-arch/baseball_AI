package com.bros.backend.auth.dto;

import java.time.format.DateTimeFormatter;

import com.bros.backend.user.User;

/** 로그인 응답 / GET /api/auth/me. 마이페이지 "내 정보" 카드가 이 값을 그대로 보여줍니다. */
public class UserInfoResponse {

    private static final DateTimeFormatter DISPLAY_FORMAT = DateTimeFormatter.ofPattern("yyyy.MM.dd HH:mm");

    private String username;
    private String name;
    /** USER / ADMIN - 프론트가 관리자에게만 "회원 승인 관리" 버튼을 보여줄 때 사용 */
    private String role;
    /** PENDING / APPROVED / REJECTED */
    private String status;
    private String createdAt;
    /** 관리자가 승인(또는 거절)한 시각. 자동 생성된 관리자 계정처럼 처리 기록이 없으면 null */
    private String reviewedAt;
    /** 프로필 사진 주소 (API 서버 기준 경로). 사진이 없으면 null. ?v= 값은 사진이 바뀔 때마다 달라짐 */
    private String profileImageUrl;

    private UserInfoResponse() {
    }

    public static UserInfoResponse from(User user) {
        UserInfoResponse res = new UserInfoResponse();
        res.username = user.getUsername();
        res.name = user.getName();
        res.role = user.getRole().name();
        res.status = user.getStatus().name();
        res.createdAt = user.getCreatedAt().format(DISPLAY_FORMAT);
        res.reviewedAt = user.getReviewedAt() == null ? null : user.getReviewedAt().format(DISPLAY_FORMAT);
        res.profileImageUrl = user.getProfileImage() == null ? null
                : "/api/mypage/profile-image?v=" + user.getProfileImage();
        return res;
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

    public String getStatus() {
        return status;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public String getReviewedAt() {
        return reviewedAt;
    }

    public String getProfileImageUrl() {
        return profileImageUrl;
    }
}
