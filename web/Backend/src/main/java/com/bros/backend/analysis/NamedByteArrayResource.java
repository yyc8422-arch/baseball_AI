package com.bros.backend.analysis;

import org.springframework.core.io.ByteArrayResource;

/**
 * ByteArrayResource 는 기본적으로 getFilename() 이 null 이라, 그대로 RestTemplate 멀티파트에 넣으면
 * AI-Server(FastAPI UploadFile)가 파일명을 못 받습니다. 파일명을 함께 들고 다니도록 오버라이드.
 */
public class NamedByteArrayResource extends ByteArrayResource {

    private final String filename;

    public NamedByteArrayResource(byte[] byteArray, String filename) {
        super(byteArray);
        this.filename = filename;
    }

    @Override
    public String getFilename() {
        return filename;
    }
}
