package com.bros.backend.highlight;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bros.backend.common.ApiException;
import com.bros.backend.highlight.dto.GameInfoResponse;
import com.bros.backend.highlight.dto.HighlightClipResponse;
import com.bros.backend.highlight.dto.HighlightPageResponse;

/**
 * highlight.html/highlight.js 가 보여주는 최신 경기 + 하이라이트 장면 조회 (로그인 필수, WebMvcConfig).
 * 경기/장면 등록은 관리자 화면(AdminHighlightController)에서 합니다.
 *
 * 참고: 이 컨트롤러는 "저장된 경기/하이라이트를 조회"만 합니다. 경기 하이라이트 영상을 올리면
 * AI-Server 가 자동으로 장면을 찾아 games/highlight_clips 테이블에 채워주는 부분은
 * AI-Server 쪽 분석 파이프라인이 완성된 뒤 별도로 연동이 필요합니다 (현재는 진행 상태만 조회 가능).
 */
@RestController
@RequestMapping("/api/highlights")
public class HighlightController {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy.MM.dd");

    private final GameRepository gameRepository;
    private final HighlightClipRepository highlightClipRepository;

    public HighlightController(GameRepository gameRepository, HighlightClipRepository highlightClipRepository) {
        this.gameRepository = gameRepository;
        this.highlightClipRepository = highlightClipRepository;
    }

    @GetMapping("/latest")
    public HighlightPageResponse latest() {
        Game game = gameRepository.findTopByOrderByGameDateDescIdDesc()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "등록된 경기 정보가 없습니다."));

        List<HighlightClip> clips = highlightClipRepository.findByGameIdOrderByIdAsc(game.getId());

        GameInfoResponse gameResponse = new GameInfoResponse(
                game.getGameDate().format(DATE_FORMAT), game.getOpponent(), game.getScore());

        List<HighlightClipResponse> clipResponses = clips.stream()
                .map(HighlightController::toResponse)
                .collect(Collectors.toList());

        return new HighlightPageResponse(gameResponse, clipResponses);
    }

    /** 하이라이트 페이지와 관리자 화면이 같은 모양으로 쓰는 장면 응답 */
    static HighlightClipResponse toResponse(HighlightClip c) {
        return new HighlightClipResponse(
                String.valueOf(c.getId()), c.getPosition(), c.getCategory(), c.getAction(),
                c.getActionLabel(), c.getTimestampLabel(), c.getClipUrl(), c.getThumbnailUrl());
    }
}
