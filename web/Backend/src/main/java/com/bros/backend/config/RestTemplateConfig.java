package com.bros.backend.config;

import java.time.Duration;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofSeconds(10))
                // 영상 업로드/분석은 시간이 걸릴 수 있어 읽기 타임아웃을 넉넉하게 둡니다.
                .setReadTimeout(Duration.ofMinutes(10))
                .build();
    }
}
