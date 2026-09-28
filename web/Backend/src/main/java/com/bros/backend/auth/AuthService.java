package com.bros.backend.auth;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bros.backend.auth.dto.LoginRequest;
import com.bros.backend.auth.dto.PasswordChangeRequest;
import com.bros.backend.auth.dto.SignupRequest;
import com.bros.backend.auth.dto.UsernameCheckResponse;
import com.bros.backend.common.ApiException;
import com.bros.backend.user.User;
import com.bros.backend.user.UserRepository;
import com.bros.backend.user.UserStatus;

@Service
public class AuthService {

    private static final int MIN_PASSWORD_LENGTH = 8;

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepository, BCryptPasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public UsernameCheckResponse checkUsername(String username) {
        if (username == null || username.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "아이디를 입력해주세요.");
        }
        boolean taken = userRepository.existsByUsername(username);
        return new UsernameCheckResponse(!taken, taken ? "이미 사용 중인 아이디입니다." : "사용 가능한 아이디입니다.");
    }

    @Transactional
    public void signup(SignupRequest req) {
        if (isBlank(req.getName()) || isBlank(req.getUsername()) || isBlank(req.getPassword())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "이름, 아이디, 비밀번호를 모두 입력해주세요.");
        }
        if (userRepository.existsByUsername(req.getUsername())) {
            throw new ApiException(HttpStatus.CONFLICT, "이미 사용 중인 아이디입니다.");
        }
        User user = new User(req.getUsername(), passwordEncoder.encode(req.getPassword()), req.getName());
        userRepository.save(user);
    }

    /** 로그인 성공 시 User 엔티티를 반환. 컨트롤러가 세션에 정보를 심습니다. */
    public User login(LoginRequest req) {
        if (isBlank(req.getUsername()) || isBlank(req.getPassword())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "아이디와 비밀번호를 입력해주세요.");
        }
        User user = userRepository.findByUsername(req.getUsername())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "아이디 또는 비밀번호가 일치하지 않습니다."));

        if (!passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "아이디 또는 비밀번호가 일치하지 않습니다.");
        }
        if (user.getStatus() == UserStatus.PENDING) {
            throw new ApiException(HttpStatus.FORBIDDEN, "관리자 승인 대기 중입니다. 승인 후 로그인하실 수 있습니다.");
        }
        if (user.getStatus() == UserStatus.REJECTED) {
            throw new ApiException(HttpStatus.FORBIDDEN, "가입이 승인되지 않았습니다. 관리자에게 문의해주세요.");
        }
        return user;
    }

    /** 마이페이지 비밀번호 변경. 현재 비밀번호를 한 번 더 확인합니다. */
    @Transactional
    public void changePassword(Long userId, PasswordChangeRequest req) {
        if (isBlank(req.getCurrentPassword()) || isBlank(req.getNewPassword())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "현재 비밀번호와 새 비밀번호를 모두 입력해주세요.");
        }
        User user = getUserOrThrow(userId);
        if (!passwordEncoder.matches(req.getCurrentPassword(), user.getPasswordHash())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "현재 비밀번호가 일치하지 않습니다.");
        }
        if (req.getNewPassword().length() < MIN_PASSWORD_LENGTH) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "새 비밀번호는 " + MIN_PASSWORD_LENGTH + "자 이상이어야 합니다.");
        }
        if (req.getNewPassword().equals(req.getCurrentPassword())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "새 비밀번호가 현재 비밀번호와 같습니다.");
        }
        user.setPasswordHash(passwordEncoder.encode(req.getNewPassword()));
    }

    public User getUserOrThrow(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
