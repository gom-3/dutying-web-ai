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
/**
 * 운영 API 호스트. 이 뒤에 붙은 엔진은 운영 설정으로 돈다.
 * 기능이 엔진 쪽 설정에 의존할 때(예: 조절 솔버) 이 목록으로 가른다.
 */
const PRODUCTION_API_HOSTS = new Set(['api.dutying.ai', 'api.dutying.net']);

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
 * 자동완성 결과를 조절하는 칩.
 *
 * 이 기능은 화면만으로 성립하지 않는다. 엔진의 조절 솔버(`adjust_solver_enabled`)가 켜져 있어야
 * 하고, 그 값은 **dev 에만 켜져 있다**(운영은 기본 꺼짐이며, 꺼진 엔진은 조절 요청을 거절만 하고
 * LLM 으로 폴백하지 않는다). 그래서 앱 도메인이 아니라 **붙어 있는 API 호스트**로 가른다 —
 * 판단해야 하는 것은 "지금 이 화면이 어디에 요청을 보내는가" 이기 때문이다.
 *
 * - 명시 override: `VITE_AI_ADJUST_ENABLED=true|false`
 * - 그 외: 운영 API(`api.dutying.*`)가 아니면 켠다. dev·로컬에서 그대로 테스트할 수 있다.
 *
 * 운영에서 켤 때는 엔진 설정을 먼저 켜고 이 목록이나 override 를 손댄다. 순서가 반대면
 * 칩은 보이는데 누르면 실패한다.
 */
export function isAiAdjustEnabled(): boolean {
    const override = import.meta.env.VITE_AI_ADJUST_ENABLED;

    if (override === 'true') return true;

    if (override === 'false') return false;

    try {
        return !PRODUCTION_API_HOSTS.has(new URL(RUNTIME_CONFIG.serverUrl()).hostname);
    } catch {
        return false;
    }
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
