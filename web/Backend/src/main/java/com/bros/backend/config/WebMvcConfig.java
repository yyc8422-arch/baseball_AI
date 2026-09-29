package com.bros.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final SessionAuthInterceptor sessionAuthInterceptor;

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    public WebMvcConfig(SessionAuthInterceptor sessionAuthInterceptor) {
        this.sessionAuthInterceptor = sessionAuthInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 모든 기능은 회원 전용: 영상 분석, 하이라이트, 마이페이지, 관리자 API 는 로그인 필수.
        // (로그인/회원가입 등 /api/auth/** 만 비로그인 허용. 관리자인지는 AdminService 가 한 번 더 확인)
        registry.addInterceptor(sessionAuthInterceptor)
                .addPathPatterns("/api/analysis/**", "/api/highlights/**", "/api/mypage/**", "/api/admin/**");
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        // 세션 쿠키를 주고받아야 해서 allowCredentials(true) + allowedOriginPatterns 조합 사용
        // (allowedOrigins("*") 는 credentials 와 함께 쓸 수 없음)
        registry.addMapping("/api/**")
                .allowedOriginPatterns(allowedOrigins.split(","))
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}
