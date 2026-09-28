package com.bros.backend.user;

/** 일반 회원(USER)과 관리자(ADMIN) 구분. 관리자는 admin.html 에서 가입 신청을 승인/거절할 수 있습니다. */
public enum UserRole {
    USER,
    ADMIN
}
