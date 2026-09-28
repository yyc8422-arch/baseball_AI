/**
 * BROS - Spring 백엔드 공용 호출 도우미
 * 다른 스크립트(auth.js, analysis.js, shell.js, admin.js 등)보다 먼저 불러와야 합니다.
 *
 * 로그인은 세션 쿠키로 유지되기 때문에 모든 요청에 credentials: "include" 를 붙입니다.
 * (프론트를 file:// 로 열면 쿠키가 안 붙으니 Live Server 같은 http://localhost:5500 으로 여세요)
 */
(function () {
  /**
   * Spring 백엔드 포트. 백엔드 application.yml 의 server.port 와 반드시 같아야 합니다.
   * 8080 이 이미 사용 중이라 8081 로 실행 중. 다른 포트로 띄우면 여기만 바꾸면 됩니다.
   */
  const API_PORT = 8081;

  /**
   * 호스트는 지금 페이지를 연 주소를 그대로 따라갑니다.
   * 페이지는 127.0.0.1 인데 API 는 localhost 로 부르면, 브라우저가 둘을 다른 사이트로 보고
   * 로그인 세션 쿠키를 저장하지 않아서 로그인해도 바로 풀립니다. (file:// 로 열면 localhost)
   */
  const API_HOST = window.location.hostname || "localhost";
  const API_BASE_URL = `http://${API_HOST}:${API_PORT}`;

  const OFFLINE_MESSAGE = "서버에 연결할 수 없어요. 백엔드 서버가 켜져 있는지 확인해주세요.";

  /** 서버가 보낸 에러 메시지({"detail": "..."})를 꺼내고, 없으면 기본 문구 사용 */
  async function readErrorMessage(res, fallback) {
    try {
      const body = await res.json();
      if (typeof body.detail === "string") return body.detail;
    } catch (e) {}
    return fallback;
  }

  /**
   * JSON API 호출. 실패하면 서버의 detail 메시지를 담은 Error 를 던지고, err.status 에 HTTP 상태코드를 넣습니다.
   * (서버에 아예 연결이 안 되면 err.status 는 0)
   * @param {string} path 예: "/api/auth/login"
   * @param {{method?: string, json?: any, fallbackError?: string}} [options]
   */
  async function request(path, options = {}) {
    const { method = "GET", json, fallbackError = "요청을 처리하지 못했어요." } = options;
    const init = { method, credentials: "include", headers: {} };
    if (json !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(json);
    }

    let res;
    try {
      res = await fetch(`${API_BASE_URL}${path}`, init);
    } catch (e) {
      const err = new Error(OFFLINE_MESSAGE);
      err.status = 0;
      throw err;
    }
    if (!res.ok) {
      const err = new Error(await readErrorMessage(res, fallbackError));
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }

  window.BROS = window.BROS || {};
  window.BROS.api = { API_BASE_URL, OFFLINE_MESSAGE, readErrorMessage, request };
})();
