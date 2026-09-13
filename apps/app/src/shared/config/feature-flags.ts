import {RUNTIME_CONFIG} from './runtime';

/**
 * 프로덕션 앱 도메인 — 여기서는 LINKED 계정 온보딩 미리보기 불가.
 * 앱의 정식 주소는 www.dutying.ai 이고 apex 는 거기로 301 된다.
 * app.dutying.ai 는 구 주소·딥링크 호환으로 같은 배포에 계속 붙여둔다.
 */
const PRODUCTION_APP_HOSTS = new Set(['www.dutying.ai', 'dutying.ai', 'app.dutying.ai', 'app.dutying.net']);
/**
 * 병동톡 라우트가 없는 프로덕션 API 호스트.
 * `.ai` 운영 서버는 `/wards/{id}/chat/**` 를 제공하므로 여기 들어가면 안 된다.
 * 구 `.net` 서버에만 없다.
 */
const PRODUCTION_API_HOSTS_WITHOUT_WARD_CHAT = new Set(['api.dutying.net']);

function getAppHostname(): string | null {
    if (typeof window === 'undefined') return null;

    return window.location.hostname;
}

/**
 * 접속 중인 앱 도메인이 dev/staging/로컬/프리뷰인지 판별한다.
 * Vercel env 없이 `window.location.hostname`만 사용한다.
 */
export function isNonProductionAppDomain(hostname: string = getAppHostname() ?? ''): boolean {
    if (!hostname) return false;

    if (PRODUCTION_APP_HOSTS.has(hostname)) return false;

    if (hostname === 'localhost') return true;

    if (hostname.endsWith('.vercel.app')) return true;

    if (hostname.endsWith('.pages.dev')) return true;

    if (hostname.endsWith('.local')) return true;

    if (hostname.startsWith('local.')) return true;

    if (hostname === 'dev.dutying.ai' || hostname === 'dev.dutying.net') return true;

    if (hostname.startsWith('staging.')) return true;

    return false;
}

/**
 * 온보딩 병동 생성 UI를 WARD_SELECT_PENDING이 아닌 계정(LINKED 등)에서도 열 수 있게 한다.
 *
 * - 로컬 dev server: `import.meta.env.DEV`
 * - 그 외: **접속 도메인**이 프로덕션(`www.dutying.ai` 등 PRODUCTION_APP_HOSTS)이 아니면 허용
 * - 명시 override: `VITE_ALLOW_ONBOARDING_PREVIEW=true|false`
 */
export function isOnboardingWardCreatePreviewAllowed(): boolean {
    const override = import.meta.env.VITE_ALLOW_ONBOARDING_PREVIEW;

    if (override === 'true') return true;

    if (override === 'false') return false;

    const hostname = getAppHostname();

    if (hostname && PRODUCTION_APP_HOSTS.has(hostname)) return false;

    return import.meta.env.DEV || isNonProductionAppDomain(hostname ?? '');
}

/**
 * 근무표 조절을 보여줄지.
 *
 * 판정은 **서버가 한다**. 근무표 작성 진입 시 이미 부르는 `GET .../schedule/workspace` 응답의
 * `autofillAdjustEnabled` 를 그대로 받아 쓴다. 전에는 붙어 있는 API 호스트로 짐작했는데,
 * 클라이언트 판단이라 우회할 수 있었고 사람 단위로 열 수도 없었다.
 *
 * - 그 값이 `true` 인 계정만 켜진다. `false` 도 값이 아예 없는 구 서버도 모두 꺼짐 —
 *   서버가 먼저 나가고 웹이 따라가는 순서에서 웹이 앞서 열어 버리는 일이 없어야 한다.
 * - `VITE_AI_ADJUST_ENABLED=true` 강제 켜기는 **비프로덕션 도메인에서만** 듣는다.
 *   빌드 환경변수는 사람이 CI 설정에서 켜고 잊는 물건이라, 운영에서까지 서버 판정을
 *   덮게 두면 어드민에서 막은 계정에 조절이 열린다. 끄는 쪽(`false`)은 어디서나 듣는다.
 *
 * 서버가 막은 계정이 조절을 요청해도 403 이 오고 기존 실패 처리가 되돌린다.
 */
export function isAiAdjustEnabled(serverEnabled: boolean | undefined): boolean {
    const override = import.meta.env.VITE_AI_ADJUST_ENABLED;

    if (override === 'false') return false;

    if (override === 'true' && isNonProductionAppDomain()) return true;

    return serverEnabled === true;
}

export function isWardChatEnabled(): boolean {
    const override = import.meta.env.VITE_ENABLE_WARD_CHAT;

    if (override === 'true') return true;

    if (override === 'false') return false;

    try {
        return !PRODUCTION_API_HOSTS_WITHOUT_WARD_CHAT.has(new URL(RUNTIME_CONFIG.serverUrl()).hostname);
    } catch {
        return false;
    }
}
