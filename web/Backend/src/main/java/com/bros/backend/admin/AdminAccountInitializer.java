package com.bros.backend.admin;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import com.bros.backend.user.User;
import com.bros.backend.user.UserRepository;
import com.bros.backend.user.UserRole;
import com.bros.backend.user.UserStatus;

/**
 * 첫 관리자 계정 만들기.
 * 관리자도 승인을 받아야 로그인할 수 있으면 처음 한 명은 승인해줄 사람이 없기 때문에,
 * application-local.yml 의 app.admin.username/password 로 서버 시작 시 한 번 만들어 둡니다.
 * 같은 아이디가 이미 있으면 아무것도 바꾸지 않습니다.
 */
@Component
public class AdminAccountInitializer implements ApplicationRunner {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final String username;
    private final String password;
    private final String name;

    public AdminAccountInitializer(UserRepository userRepository, BCryptPasswordEncoder passwordEncoder,
                                   @Value("${app.admin.username:}") String username,
                                   @Value("${app.admin.password:}") String password,
                                   @Value("${app.admin.name:관리자}") String name) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.username = username;
        this.password = password;
        this.name = name;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (username.isBlank() || password.isBlank()) return;
        if (userRepository.existsByUsername(username)) return;

        User admin = new User(username, passwordEncoder.encode(password), name);
        admin.setRole(UserRole.ADMIN);
        admin.setStatus(UserStatus.APPROVED);
        userRepository.save(admin);
        System.out.println("[BROS] 관리자 계정을 생성했습니다: " + username);
    }
}
