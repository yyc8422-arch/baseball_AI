package com.bros.backend.mypage;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.bros.backend.common.ApiException;
import com.bros.backend.user.User;
import com.bros.backend.user.UserRepository;

/**
 * 마이페이지 프로필 사진.
 * 파일은 app.upload-dir/profile 아래에 "user-{id}-{랜덤}.{확장자}" 로 저장하고, users.profile_image 에 파일 이름만 기록합니다.
 * 파일 이름이 바뀔 때마다 URL 도 바뀌므로 브라우저 캐시 때문에 예전 사진이 보이는 일이 없습니다.
 */
@Service
public class ProfileImageService {

    private static final long MAX_SIZE_BYTES = 5L * 1024 * 1024;

    private final UserRepository userRepository;
    private final Path profileDir;

    public ProfileImageService(UserRepository userRepository, @Value("${app.upload-dir:uploads}") String uploadDir) {
        this.userRepository = userRepository;
        this.profileDir = Paths.get(uploadDir, "profile").toAbsolutePath().normalize();
    }

    @Transactional
    public void save(Long userId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "사진 파일을 선택해주세요.");
        }
        if (file.getSize() > MAX_SIZE_BYTES) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "사진은 5MB 이하만 올릴 수 있습니다.");
        }
        // 브라우저가 보내는 Content-Type/확장자는 바꿔치기할 수 있어서, 파일 앞부분 바이트로 실제 형식을 판단합니다.
        String ext = detectImageExtension(file);
        if (ext == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "JPG, PNG, WEBP, GIF 사진만 올릴 수 있습니다.");
        }

        User user = getUser(userId);
        String fileName = "user-" + userId + "-" + UUID.randomUUID().toString().substring(0, 8) + "." + ext;
        try {
            Files.createDirectories(profileDir);
            file.transferTo(profileDir.resolve(fileName));
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "사진을 저장하지 못했습니다.");
        }

        deleteFileQuietly(user.getProfileImage());
        user.setProfileImage(fileName);
    }

    @Transactional
    public void delete(Long userId) {
        User user = getUser(userId);
        deleteFileQuietly(user.getProfileImage());
        user.setProfileImage(null);
    }

    public Resource load(Long userId) {
        User user = getUser(userId);
        if (user.getProfileImage() == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "등록된 프로필 사진이 없습니다.");
        }
        Path path = profileDir.resolve(user.getProfileImage()).normalize();
        if (!path.startsWith(profileDir) || !Files.exists(path)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "등록된 프로필 사진이 없습니다.");
        }
        return new FileSystemResource(path);
    }

    public static MediaType mediaTypeOf(String fileName) {
        String ext = fileName.substring(fileName.lastIndexOf('.') + 1);
        return switch (ext) {
            case "png" -> MediaType.IMAGE_PNG;
            case "gif" -> MediaType.IMAGE_GIF;
            case "webp" -> MediaType.parseMediaType("image/webp");
            default -> MediaType.IMAGE_JPEG;
        };
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
    }

    private void deleteFileQuietly(String fileName) {
        if (fileName == null) return;
        try {
            Files.deleteIfExists(profileDir.resolve(fileName).normalize());
        } catch (IOException ignored) {
            // 예전 파일이 안 지워져도 새 사진 저장에는 지장이 없으므로 무시
        }
    }

    private static String detectImageExtension(MultipartFile file) {
        byte[] head = new byte[12];
        try (InputStream in = file.getInputStream()) {
            int read = in.readNBytes(head, 0, head.length);
            if (read < head.length) return null;
        } catch (IOException e) {
            return null;
        }
        if ((head[0] & 0xFF) == 0xFF && (head[1] & 0xFF) == 0xD8 && (head[2] & 0xFF) == 0xFF) return "jpg";
        if ((head[0] & 0xFF) == 0x89 && head[1] == 'P' && head[2] == 'N' && head[3] == 'G') return "png";
        if (head[0] == 'G' && head[1] == 'I' && head[2] == 'F' && head[3] == '8') return "gif";
        if (Arrays.equals(Arrays.copyOfRange(head, 0, 4), "RIFF".getBytes())
                && Arrays.equals(Arrays.copyOfRange(head, 8, 12), "WEBP".getBytes())) return "webp";
        return null;
    }
}
