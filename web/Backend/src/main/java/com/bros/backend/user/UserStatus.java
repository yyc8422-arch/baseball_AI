package com.bros.backend.user;

/**
 * login.html 의 안내문구("가입 신청 후 관리자 승인이 완료되어야 로그인하실 수 있습니다")를 구현하기 위한 상태값.
 * 가입하면 PENDING 으로 저장되고, 관리자가 /api/admin/users/{id}/approve · reject 로 상태를 바꿉니다.
 */
public enum UserStatus {
    PENDING,
    APPROVED,
    REJECTED
}
