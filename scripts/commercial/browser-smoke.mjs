// Fixture-only browser verification. All external traffic is intercepted or blocked.
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import assert from 'node:assert/strict';
const {chromium} = await import(process.env.COMMERCIAL_PLAYWRIGHT_MODULE || 'playwright');
const root = resolve('apps/app/dist'),
    out = process.env.COMMERCIAL_SCREENSHOT_DIR || '/tmp/dutying-commercial-browser';
await mkdir(out, {recursive: true});
const server = createServer(async (req, res) => {
    try {
        let path = new URL(req.url, 'http://localhost').pathname;
        let file = resolve(root, '.' + path);
        if (!file.startsWith(root + '/')) file = resolve(root, 'index.html');
        let body;
        try {
            body = await readFile(file);
        } catch {
            file = resolve(root, 'index.html');
            body = await readFile(file);
        }
        res.setHeader(
            'Content-Type',
            {
                '.html': 'text/html',
                '.js': 'text/javascript',
                '.css': 'text/css',
                '.json': 'application/json',
                '.svg': 'image/svg+xml',
                '.woff2': 'font/woff2',
                '.png': 'image/png',
            }[extname(file)] || 'application/octet-stream',
        );
        res.end(body);
    } catch {
        res.writeHead(500);
        res.end();
    }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.COMMERCIAL_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const scopes = [
    {type: 'WARD', ref: '10', scopeId: 'ward-scope', name: '3병동', role: 'OWNER'},
    {type: 'HOSPITAL', ref: 'hospital-1', scopeId: 'hospital-scope', name: '테스트 병원', role: 'OWNER'},
];
const policy = (plan) => ({
    plan,
    baseGross: plan === 'FREE' ? 0 : plan === 'PLUS' ? 19900 : 49000,
    includedStaff: plan === 'FREE' ? 30 : 50,
    extraStaffGross: plan === 'FREE' ? 0 : plan === 'PLUS' ? 990 : 880,
    generate: plan === 'FREE' ? 3 : plan === 'PLUS' ? 30 : 90,
    adjust: plan === 'FREE' ? 1 : plan === 'PLUS' ? 10 : 30,
    adminSeats: 10,
    generatePackSize: 10,
    generatePackGross: 2900,
    adjustPackSize: 5,
    adjustPackGross: 4900,
    validityDays: 365,
    setupBase: 249000,
    setupExtra: 2000,
    features: {REQUEST_CREATE: plan !== 'FREE', BOARD_CREATE: plan !== 'FREE', HOSPITAL_OVERVIEW: plan === 'HOSPITAL'},
});
const scopeObj = (h) => ({
    id: h ? 'hospital-scope' : 'ward-scope',
    scopeType: h ? 'HOSPITAL' : 'WARD',
    scopeRef: h ? 'hospital-1' : '10',
    version: 1,
    periodStart: '2026-09-01T00:00:00',
    periodEnd: '2026-10-01T00:00:00',
    cancelAtPeriodEnd: false,
    customerId: h ? 'hospital-customer' : 'ward-customer',
});
const entitlement = (h) => ({
    scope: scopeObj(h),
    billingScopeId: h ? 'hospital-scope' : 'ward-scope',
    role: 'OWNER',
    plan: h ? 'HOSPITAL' : 'FREE',
    entitlementSource: h ? 'SUBSCRIPTION' : 'FREE',
    capacity: {used: 25, purchased: h ? 50 : 30, overLimit: false},
    adminSeats: {active: 2, reserved: 1, limit: 10},
    usage: [
        {meter: 'FULL_GENERATE', granted: h ? 90 : 3, used: 1, reserved: 0, remaining: h ? 89 : 2, lots: []},
        {meter: 'PARTIAL_ADJUST', granted: h ? 30 : 1, used: 0, reserved: 0, remaining: h ? 30 : 1, lots: []},
    ],
    allowedActions: [
        'BILLING_MANAGE',
        'WARD_INVITE_CREATE',
        'ORG_INVITE_CREATE',
        'AI_GENERATE',
        'AI_ADJUST',
        'OWNER_TRANSFER',
        'MEMBER_REMOVE',
    ],
    promotion: null,
    policy: policy(h ? 'HOSPITAL' : 'FREE'),
    canManageBilling: true,
    checkoutEnabled: false,
});
const members = {
    members: [
        {membershipId: 1, accountId: 1, name: '수간호사', email: 'owner@example.test', role: 'OWNER'},
        {membershipId: 2, accountId: 2, name: '부관리자', email: 'editor@example.test', role: 'EDITOR'},
    ],
    invitations: [{id: 'inv-1', email: 'invited@example.test', status: 'PENDING', expiresAt: '2026-10-05T00:00:00', version: 0}],
    reservedEmails: [],
};
const errors = [],
    unexpected = [];
let orgOnly = false;
try {
    const context = await browser.newContext({viewport: {width: 1440, height: 1000}, locale: 'ko-KR'});
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
        const payload = btoa(JSON.stringify({principalType: 'WARD_ADMIN', wardAdminAccountId: 1, exp: 4102444800}));
        localStorage.setItem(
            'useAuthStore',
            JSON.stringify({
                state: {isAuth: true, accessToken: `e30.${payload}.fixture`, accountId: 1, nurseId: null, wardId: 10, demoStartDate: null},
                version: 0,
            }),
        );
        localStorage.setItem('i18nextLng', 'ko');
    });
    await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.origin === origin) return route.continue();
        if (!url.pathname.startsWith('/admin/') && !url.pathname.startsWith('/accounts/')) return route.abort();
        const path = url.pathname;
        let data;
        if (path === '/accounts/default-images') data = [];
        else if (path === '/admin/accounts/me')
            data = {
                accountId: 1,
                adminAccountId: 1,
                name: '수간호사',
                email: 'owner@example.test',
                status: orgOnly ? 'WORKSPACE_SETUP_PENDING' : 'LINKED',
                wardId: orgOnly ? null : 10,
                role: 'OWNER',
                preferredLanguage: 'ko',
                memberships: orgOnly ? [] : [{wardId: 10, role: 'OWNER', status: 'ACTIVE'}],
            };
        else if (path.endsWith('/access-context'))
            data = {enabled: true, scopes: orgOnly ? [scopes[1]] : scopes, invitations: [], transfers: []};
        else if (path.endsWith('/plans')) data = ['FREE', 'PLUS', 'HOSPITAL'].map((plan) => ({id: plan, config: policy(plan)}));
        else if (path.endsWith('/entitlements')) data = entitlement(path.includes('/HOSPITAL/'));
        else if (
            path.endsWith('/campaigns') ||
            path.endsWith('/notices') ||
            path.endsWith('/receipts') ||
            path.endsWith('/ward-links') ||
            path.endsWith('/support-grants')
        )
            data = [];
        else if (path.endsWith('/admins') || path.endsWith('/members')) data = members;
        else if (path.endsWith('/estimates')) {
            const draft = route.request().postDataJSON();
            assert.equal(draft.capacity, 100);
            assert.equal(draft.setupStaff, 100);
            data = {
                policyId: 'hospital-policy',
                estimate: {monthlyGross: 93000, setupGross: 349000, generate: 120, adjust: 40, supportSeconds: 3300, firstGross: 442000},
            };
        } else if (path.endsWith('/payment-method')) data = {registered: false, termsVersion: 'commercial-terms-v1'};
        else if (path.endsWith('/support'))
            data = {allowance: {includedSeconds: 1800, usedSeconds: 300, remainingSeconds: 1500}, offers: []};
        else if (path === '/admin/commercial/support-staff') data = [];
        else if (path.includes('/billing-scopes/'))
            data = {
                scope: scopeObj(path.includes('hospital')),
                customer: {name: '테스트 고객', plan: 'HOSPITAL', paymentMode: 'PREPAID', capacity: 50},
                invoices: [],
                orders: [],
                requests: [],
            };
        else if (path.endsWith('/organizations/hospital-1'))
            data = {
                organization: {
                    id: 'hospital-1',
                    name: '테스트 병원',
                    status: 'ACTIVE',
                    adoptionStage: 'LIVE',
                    requestedCapacity: 50,
                    setupStaff: 50,
                },
                role: 'OWNER',
                wards: [
                    {
                        id: 'link-1',
                        wardId: 10,
                        name: '3병동',
                        staff: 25,
                        status: 'ACTIVE',
                        version: 1,
                        canOpenWard: false,
                        scheduleStatus: 'IN_PROGRESS',
                        currentMonth: '2026-09',
                        updatedAt: '2026-09-24T00:00:00',
                        contactName: '수간호사',
                    },
                ],
                entitlement: entitlement(true),
            };
        else {
            unexpected.push(path);
            data = [];
        }
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: {'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true'},
            body: JSON.stringify(data),
        });
    });
    for (const [path, text, file] of [
        ['/workspace/plans', '우리 병동에 맞는 요금제', 'plans'],
        ['/workspace/WARD/10/usage', '3병동', 'ward-usage'],
        ['/workspace/WARD/10/members', '관리자와 초대', 'members'],
        ['/workspace/HOSPITAL/hospital-1/overview', '테스트 병원', 'hospital'],
        ['/workspace/HOSPITAL/hospital-1/billing', 'Hospital', 'billing'],
        ['/workspace/adoption', '병원', 'adoption'],
    ]) {
        await page.goto(origin + path + '?lng=ko');
        await page.getByRole('main').waitFor();
        await page.waitForFunction(() => document.querySelector('.workspace-section'));
        await page.getByRole('main').getByText(text, {exact: false}).first().waitFor();
        assert((await page.locator('.workspace-section').count()) > 0);
        await page.waitForLoadState('networkidle');
        if (file === 'billing') {
            await page.getByRole('heading', {name: '청구·결제 내역', exact: true}).waitFor();
            await page.getByLabel('매월 계약할 인원 N', {exact: true}).fill('100');
            await page.getByLabel('처음 직접 세팅할 인원 S', {exact: true}).fill('100');
            await page.getByRole('button', {name: '견적 계산', exact: true}).click();
            await page.getByText('₩93,000', {exact: true}).waitFor();
            await page.getByText('₩349,000', {exact: true}).waitFor();
        }
        await page.screenshot({path: `${out}/${file}.png`, fullPage: true});
    }
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(origin + '/workspace/HOSPITAL/hospital-1/billing?lng=ko');
    await page.waitForFunction(() => document.querySelector('.workspace-section'));
    await page.getByRole('heading', {name: '청구·결제 내역', exact: true}).waitFor();
    await page.waitForLoadState('networkidle');
    await page.screenshot({path: `${out}/mobile-billing.png`, fullPage: true});
    assert(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        'Mobile page must not overflow horizontally',
    );
    orgOnly = true;
    await page.goto(origin + '/onboarding?lng=ko');
    await page.waitForURL(/\/workspace/);
    await page.getByRole('heading', {name: '내 관리 공간', exact: true}).waitFor();
    assert.deepEqual(errors, []);
    assert.deepEqual([...new Set(unexpected)], []);
    console.log(JSON.stringify({status: 'passed', pages: 7, orgOnlyOnboarding: true, screenshots: out}));
} finally {
    await browser.close();
    await new Promise((r) => server.close(r));
}
