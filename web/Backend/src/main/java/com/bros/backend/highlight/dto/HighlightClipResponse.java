package com.bros.backend.highlight.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/** highlight.js 의 HighlightClip 타입과 동일한 필드명(id/position/category/action/actionLabel/timestamp/clipUrl/thumbnailUrl) */
public class HighlightClipResponse {
    private String id;
    private String position;
    private String category;
    private String action;
    private String actionLabel;

    @JsonProperty("timestamp")
    private String timestamp;

    private String clipUrl;
    private String thumbnailUrl;

    public HighlightClipResponse(String id, String position, String category, String action,
                                  String actionLabel, String timestamp, String clipUrl, String thumbnailUrl) {
        this.id = id;
        this.position = position;
        this.category = category;
        this.action = action;
        this.actionLabel = actionLabel;
        this.timestamp = timestamp;
        this.clipUrl = clipUrl == null ? "" : clipUrl;
        this.thumbnailUrl = thumbnailUrl == null ? "" : thumbnailUrl;
    }

    public String getId() {
        return id;
    }

    public String getPosition() {
        return position;
    }

    public String getCategory() {
        return category;
    }

    public String getAction() {
        return action;
    }

    public String getActionLabel() {
        return actionLabel;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public String getClipUrl() {
        return clipUrl;
    }

    public String getThumbnailUrl() {
        return thumbnailUrl;
    }
}
