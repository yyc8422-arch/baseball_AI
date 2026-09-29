package com.bros.backend.analysis;

import java.io.IOException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriComponentsBuilder;

import com.bros.backend.analysis.dto.AnalysisStatusResponse;
import com.bros.backend.analysis.dto.VideoUploadResponse;
import com.bros.backend.common.ApiException;

/** AI-Server(FastAPI, http://localhost:8000)와 실제로 통신하는 유일한 클래스. */
@Component
public class AiServerClient {

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public AiServerClient(RestTemplate restTemplate, @Value("${ai-server.base-url}") String baseUrl) {
        this.restTemplate = restTemplate;
        this.baseUrl = baseUrl;
    }

    /** POST /api/analysis 로 영상을 그대로 전달(멀티파트 프록시)합니다. */
    public VideoUploadResponse upload(MultipartFile video, String analysisType, String cameraView) {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        try {
            body.add("video", new NamedByteArrayResource(video.getBytes(), video.getOriginalFilename()));
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "영상 파일을 읽는 중 오류가 발생했습니다.");
        }
        body.add("analysisType", analysisType);
        body.add("cameraView", cameraView);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<VideoUploadResponse> response = restTemplate.postForEntity(
                    baseUrl + "/api/analysis", requestEntity, VideoUploadResponse.class);
            return response.getBody();
        } catch (HttpClientErrorException e) {
            // AI-Server 가 형식/용량 오류 등으로 4xx 를 준 경우, 가능하면 detail 메시지를 그대로 전달
            throw new ApiException(HttpStatus.valueOf(e.getStatusCode().value()), extractDetail(e, "영상 업로드에 실패했어요."));
        } catch (RestClientException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI 서버에 연결할 수 없어요. 서버가 켜져 있는지 확인해주세요.");
        }
    }

    /** GET /api/analysis/{video_id} 조회. 없으면 null (컨트롤러가 404 로 변환). */
    public AnalysisStatusResponse getStatus(String videoId, boolean includePose) {
        String url = UriComponentsBuilder.fromHttpUrl(baseUrl + "/api/analysis/{videoId}")
                .queryParam("include_pose", includePose)
                .buildAndExpand(videoId)
                .toUriString();
        try {
            ResponseEntity<AnalysisStatusResponse> response =
                    restTemplate.getForEntity(url, AnalysisStatusResponse.class);
            return response.getBody();
        } catch (HttpClientErrorException.NotFound e) {
            return null;
        } catch (RestClientException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI 서버에 연결할 수 없어요.");
        }
    }

    private String extractDetail(HttpClientErrorException e, String fallback) {
        try {
            String body = e.getResponseBodyAsString();
            if (body != null && body.contains("\"detail\"")) {
                // 별도 JSON 파서 의존성 없이 detail 값만 대략 추출 (형식이 틀어지면 fallback 사용)
                int start = body.indexOf(":\"", body.indexOf("detail")) + 2;
                int end = body.indexOf("\"", start);
                if (start > 1 && end > start) {
                    return body.substring(start, end);
                }
            }
        } catch (Exception ignored) {
            // 파싱 실패 시 fallback 사용
        }
        return fallback;
    }
}
