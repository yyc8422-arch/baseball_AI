package com.bros.backend.highlight;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bros.backend.common.ApiException;
import com.bros.backend.highlight.dto.AdminGameView;
import com.bros.backend.highlight.dto.ClipRequest;
import com.bros.backend.highlight.dto.GameRequest;
import com.bros.backend.highlight.dto.HighlightClipResponse;

/**
 * 관리자 화면(admin.html "하이라이트 관리")에서 경기와 하이라이트 장면을 등록/삭제.
 * 하이라이트 페이지(/api/highlights/latest)는 이 중 가장 최근 날짜의 경기를 보여줍니다.
 */
@Service
public class AdminHighlightService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy.MM.dd");
    private static final Set<String> CATEGORIES = Set.of("batting", "defense", "highlight");
    private static final Pattern TIMESTAMP = Pattern.compile("^\\d{1,2}:\\d{2}:\\d{2}$");

    private final GameRepository gameRepository;
    private final HighlightClipRepository clipRepository;

    public AdminHighlightService(GameRepository gameRepository, HighlightClipRepository clipRepository) {
        this.gameRepository = gameRepository;
        this.clipRepository = clipRepository;
    }

    public List<AdminGameView> listGames() {
        List<Game> games = gameRepository.findAllByOrderByGameDateDescIdDesc();
        Long showingId = games.isEmpty() ? null : games.get(0).getId();
        return games.stream()
                .map(g -> new AdminGameView(g.getId(), g.getGameDate().format(DATE_FORMAT), g.getOpponent(), g.getScore(),
                        clipRepository.countByGameId(g.getId()), g.getId().equals(showingId)))
                .toList();
    }

    @Transactional
    public void createGame(GameRequest req) {
        LocalDate date;
        try {
            date = LocalDate.parse(required(req.getGameDate(), "경기 날짜를 입력해주세요."));
        } catch (DateTimeParseException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "경기 날짜 형식이 올바르지 않습니다.");
        }
        String opponent = limit(required(req.getOpponent(), "상대 팀을 입력해주세요."), 100, "상대 팀");
        String score = limit(required(req.getScore(), "점수를 입력해주세요."), 50, "점수");
        gameRepository.save(new Game(date, opponent, score));
    }

    @Transactional
    public void deleteGame(Long gameId) {
        Game game = findGame(gameId);
        clipRepository.deleteByGameId(game.getId());
        gameRepository.delete(game);
    }

    public List<HighlightClipResponse> listClips(Long gameId) {
        findGame(gameId);
        return clipRepository.findByGameIdOrderByIdAsc(gameId).stream().map(HighlightController::toResponse).toList();
    }

    @Transactional
    public void addClip(Long gameId, ClipRequest req) {
        Game game = findGame(gameId);

        String category = required(req.getCategory(), "분류를 선택해주세요.");
        if (!CATEGORIES.contains(category)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "분류는 타격/수비/주요 플레이 중 하나여야 합니다.");
        }
        String label = limit(required(req.getActionLabel(), "장면 이름을 입력해주세요."), 100, "장면 이름");
        String timestamp = required(req.getTimestamp(), "영상 시간을 입력해주세요.");
        if (!TIMESTAMP.matcher(timestamp).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "영상 시간은 00:34:02 형식으로 입력해주세요.");
        }
        // 하이라이트 화면에서 새 탭으로 열리므로 javascript: 같은 주소는 막고 http/https 만 허용
        String clipUrl = blankToNull(req.getClipUrl());
        if (clipUrl != null) {
            clipUrl = limit(clipUrl, 500, "영상 주소");
            if (!clipUrl.startsWith("http://") && !clipUrl.startsWith("https://")) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "영상 주소는 http:// 또는 https:// 로 시작해야 합니다.");
            }
        }

        // action(장면 종류 코드)은 화면에서 쓰지 않아 분류 값으로 채움, position 은 포지션별 하이라이트 개발 전까지 비워둠
        clipRepository.save(new HighlightClip(game, null, category, category, label, timestamp, clipUrl, null));
    }

    @Transactional
    public void deleteClip(Long clipId) {
        HighlightClip clip = clipRepository.findById(clipId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "해당 장면을 찾을 수 없습니다."));
        clipRepository.delete(clip);
    }

    private Game findGame(Long gameId) {
        return gameRepository.findById(gameId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "해당 경기를 찾을 수 없습니다."));
    }

    private static String required(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, message);
        }
        return value.trim();
    }

    private static String limit(String value, int max, String name) {
        if (value.length() > max) {
            throw new ApiException(HttpStatus.BAD_REQUEST, name + "은(는) " + max + "자 이하로 입력해주세요.");
        }
        return value;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
