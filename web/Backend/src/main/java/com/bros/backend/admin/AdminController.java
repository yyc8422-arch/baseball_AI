package com.bros.backend.admin;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.bros.backend.admin.dto.AdminUserView;
import com.bros.backend.common.ApiException;
import com.bros.backend.user.User;
import com.bros.backend.user.UserStatus;

import jakarta.servlet.http.HttpSession;

/**
 * 회원가입 승인 관리 (프론트 admin.html).
 * /api/admin/** 는 WebMvcConfig 에서 로그인 필수로 막혀 있고, 여기서 한 번 더 관리자인지 확인합니다.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    /** @param status PENDING / APPROVED / REJECTED, 생략하면 전체 */
    @GetMapping("/users")
    public List<AdminUserView> users(HttpSession session, @RequestParam(required = false) String status) {
        adminService.requireAdmin(session);
        return adminService.listUsers(parseStatus(status));
    }

    @PostMapping("/users/{id}/approve")
    public AdminUserView approve(HttpSession session, @PathVariable Long id) {
        User admin = adminService.requireAdmin(session);
        return adminService.changeStatus(admin, id, UserStatus.APPROVED);
    }

    @PostMapping("/users/{id}/reject")
    public AdminUserView reject(HttpSession session, @PathVariable Long id) {
        User admin = adminService.requireAdmin(session);
        return adminService.changeStatus(admin, id, UserStatus.REJECTED);
    }

    private UserStatus parseStatus(String status) {
        if (status == null || status.isBlank()) return null;
        try {
            return UserStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "status 는 PENDING, APPROVED, REJECTED 중 하나여야 합니다.");
        }
    }
}
