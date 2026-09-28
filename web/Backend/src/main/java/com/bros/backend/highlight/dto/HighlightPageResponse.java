package com.bros.backend.highlight.dto;

import java.util.List;

public class HighlightPageResponse {
    private GameInfoResponse game;
    private List<HighlightClipResponse> highlights;

    public HighlightPageResponse(GameInfoResponse game, List<HighlightClipResponse> highlights) {
        this.game = game;
        this.highlights = highlights;
    }

    public GameInfoResponse getGame() {
        return game;
    }

    public List<HighlightClipResponse> getHighlights() {
        return highlights;
    }
}
