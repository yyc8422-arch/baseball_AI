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
        // 마이페이지처럼 "내 것"을 보여주는 API 만 로그인 필수로 막습니다.
        // 업로드/분석 조회는 비로그인 사용자도 쓸 수 있게(현재 프론트 UX 유지) 열어둡니다.
        // 관리자 API 는 여기서 로그인 여부만 막고, 관리자인지는 AdminService 가 확인합니다.
        registry.addInterceptor(sessionAuthInterceptor).addPathPatterns("/api/mypage/**", "/api/admin/**");
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
