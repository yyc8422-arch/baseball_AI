package com.bros.backend.admin;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bros.backend.admin.dto.AdminUserView;
import com.bros.backend.common.ApiException;
import com.bros.backend.common.SessionUtils;
import com.bros.backend.user.User;
import com.bros.backend.user.UserRepository;
import com.bros.backend.user.UserRole;
import com.bros.backend.user.UserStatus;

import jakarta.servlet.http.HttpSession;

@Service
public class AdminService {

    private static final DateTimeFormatter DISPLAY_FORMAT = DateTimeFormatter.ofPattern("yyyy.MM.dd HH:mm");

    private final UserRepository userRepository;

    public AdminService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * 세션의 사용자가 관리자인지 DB 에서 다시 확인합니다.
     * (세션에 role 을 캐시하지 않아서, DB 에서 관리자 권한을 빼면 바로 반영됨)
     */
    public User requireAdmin(HttpSession session) {
        Long userId = SessionUtils.requireUserId(session);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
        if (user.getRole() != UserRole.ADMIN || user.getStatus() != UserStatus.APPROVED) {
            throw new ApiException(HttpStatus.FORBIDDEN, "관리자만 사용할 수 있습니다.");
        }
        return user;
    }

    /** @param status null 이면 전체 회원 */
    public List<AdminUserView> listUsers(UserStatus status) {
        List<User> users = status == null
                ? userRepository.findAllByOrderByCreatedAtDesc()
                : userRepository.findByStatusOrderByCreatedAtDesc(status);
        return users.stream().map(this::toView).toList();
    }

    @Transactional
    public AdminUserView changeStatus(User admin, Long targetUserId, UserStatus newStatus) {
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "해당 회원을 찾을 수 없습니다."));
        if (target.getId().equals(admin.getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "본인 계정의 상태는 바꿀 수 없습니다.");
        }
        if (target.getRole() == UserRole.ADMIN) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "관리자 계정의 상태는 바꿀 수 없습니다.");
        }
        target.setStatus(newStatus);
        target.setReviewedAt(LocalDateTime.now());
        return toView(target);
    }

    private AdminUserView toView(User user) {
        return new AdminUserView(
                user.getId(),
                user.getUsername(),
                user.getName(),
                user.getStatus().name(),
                user.getRole().name(),
                user.getCreatedAt().format(DISPLAY_FORMAT),
                user.getReviewedAt() == null ? null : user.getReviewedAt().format(DISPLAY_FORMAT)
        );
    }
}
