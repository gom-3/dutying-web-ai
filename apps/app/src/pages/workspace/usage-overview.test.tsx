import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router';
import {afterEach, describe, expect, it} from 'vitest';
import type {Entitlement, Scope} from '@/features/commercial/api';
import i18n from '@/i18n';
import {UsageOverview} from './usage-overview';

const scope: Scope = {type: 'WARD', ref: '596', scopeId: 'preview-scope', name: '예시 병동', role: 'OWNER'};
const entitlement = (overrides: Partial<Entitlement> = {}): Entitlement =>
    ({
        plan: 'FREE',
        entitlementSource: 'FREE',
        canManageBilling: true,
        capacity: {used: 11, purchased: 30, overLimit: false},
        adminSeats: {active: 1, reserved: 0, limit: 2},
        restrictionStates: {ADMIN_SEATS: false},
        promotion: null,
        usage: [
            {
                meter: 'AI_FILL',
                enforced: false,
                granted: 3,
                used: 0,
                reserved: 0,
                remaining: 3,
                lots: [{id: 'base', source: 'FREE', available: 3, expiresAt: null}],
            },
        ],
        ...overrides,
    }) as Entitlement;

afterEach(cleanup);

function mount(e = entitlement(), selectedScope = scope, billingPath?: string) {
    return render(
        <MemoryRouter>
            <UsageOverview scope={selectedScope} e={e} billingPath={billingPath} />
        </MemoryRouter>,
    );
}

describe('UsageOverview', () => {
    it('distinguishes disabled limits from the included balance and keeps allowance details expandable', async () => {
        mount(entitlement(), scope, '/billing/596/subscription');
        expect(screen.getByRole('heading', {name: 'Free'})).toBeInTheDocument();
        expect(screen.getByText('횟수 제한 해제')).toBeInTheDocument();
        expect(screen.queryByRole('meter', {name: '남은 AI 채우기 횟수'})).not.toBeInTheDocument();
        expect(screen.queryByRole('meter', {name: '관리자 정원 사용량'})).not.toBeInTheDocument();
        expect(screen.getByText('19명 추가 가능')).toBeInTheDocument();
        expect(screen.getByRole('meter', {name: '편성 인원 사용량'})).toHaveAttribute('value', '11');
        expect(screen.getByRole('link', {name: '요금제·추가 횟수 보기'})).toHaveAttribute('href', '/billing/596/subscription');

        const summary = screen.getByText('상세 내역');
        const disclosure = summary.closest('details');

        expect(disclosure).not.toHaveAttribute('open');
        expect(screen.getByText(/채우기·수정 요청은 같은 횟수를 사용해요/)).not.toBeVisible();
        expect(screen.queryByText('초대 대기')).not.toBeInTheDocument();
        await userEvent.click(summary);
        expect(disclosure).toHaveAttribute('open');
        expect(screen.getByText('최초 제공 · 만료 없음')).toBeVisible();
        expect(screen.getByText('제한 해제 중에는 잔여 횟수와 관계없이 이용할 수 있어요.')).toBeVisible();
    });

    it('includes pending invitations in occupied seats without counting them as active administrators', () => {
        const e = entitlement({
            restrictionStates: {ADMIN_SEATS: true},
            adminSeats: {active: 2, reserved: 2, limit: 5},
        });

        e.usage[0] = {...e.usage[0], enforced: true, granted: 10, used: 4, reserved: 1, remaining: 5};
        mount(e);

        const administrators = screen.getByRole('article', {name: '관리자'});

        expect(within(administrators).getByText('1명 초대 가능')).toBeInTheDocument();
        expect(within(administrators).getByRole('meter')).toHaveAttribute('value', '4');
        expect(within(administrators).getByRole('meter')).toHaveAttribute('aria-valuetext', '정원 5명 중 관리자 2명, 초대 대기 2명');
        expect(screen.getByRole('meter', {name: '남은 AI 채우기 횟수'})).toHaveAttribute('value', '5');
        expect(screen.getByRole('meter', {name: '남은 AI 채우기 횟수'})).toHaveAttribute('aria-valuetext', '10회 중 5회 남음');
    });

    it('explains capacity overages and keeps existing-schedule guidance in details', async () => {
        mount(entitlement({capacity: {used: 35, purchased: 30, overLimit: true}}));
        expect(screen.getByText('편성 인원 한도 초과')).toBeInTheDocument();
        expect(screen.getByText(/한도를 초과해도 기존 근무표의 편집·확정·내보내기는 이용할 수 있어요/)).not.toBeVisible();
        expect(screen.queryByText(/명 추가 가능/)).not.toBeInTheDocument();
        expect(screen.getByRole('meter', {name: '편성 인원 사용량'})).toHaveAttribute('aria-valuetext', '최대 30명 중 35명 편성 중');
        await userEvent.click(screen.getByText('상세 내역'));
        expect(screen.getByText(/한도를 초과해도 기존 근무표의 편집·확정·내보내기는 이용할 수 있어요/)).toBeVisible();
    });

    it('does not imply a staff cap when staff capacity enforcement is disabled', () => {
        mount(
            entitlement({
                capacity: {used: 35, purchased: 30, overLimit: true},
                restrictionStates: {STAFF_CAPACITY: false, ADMIN_SEATS: false},
            }),
        );
        expect(screen.getByText('인원 제한 해제')).toBeInTheDocument();
        expect(screen.queryByRole('meter', {name: '편성 인원 사용량'})).not.toBeInTheDocument();
        expect(screen.queryByText('편성 인원 한도 초과')).not.toBeInTheDocument();
    });

    it('handles no available AI uses and full administrator seats, including pending requests', () => {
        const e = entitlement({restrictionStates: {ADMIN_SEATS: true}, adminSeats: {active: 1, reserved: 1, limit: 2}});

        e.usage[0] = {...e.usage[0], enforced: true, used: 1, reserved: 2, remaining: 0};
        mount(e);
        expect(screen.getByRole('meter', {name: '남은 AI 채우기 횟수'})).toHaveAttribute('value', '0');
        expect(screen.getByText('정원 마감 · 초대 대기 포함')).toBeInTheDocument();
        expect(screen.queryByText('횟수 제한 해제')).not.toBeInTheDocument();
    });

    it('keeps hospital sharing, trial terms and the role-specific support destination', async () => {
        mount(entitlement({plan: 'HOSPITAL', canManageBilling: false, promotion: {endsAt: '2026-12-01T00:00:00Z'}, usage: []}), {
            ...scope,
            type: 'HOSPITAL',
            ref: 'hospital-preview',
        });
        expect(screen.getByText('사용량 정보 없음')).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '운영 지원 요청하기'})).toHaveAttribute(
            'href',
            '/workspace/HOSPITAL/hospital-preview/support',
        );
        expect(screen.getByText('종료 후 Free 전환 · 자동 결제 없음')).toBeInTheDocument();
        await userEvent.click(screen.getByText('상세 내역'));
        expect(screen.getByText('편성 인원·AI 횟수는 연결된 병동이 함께 사용해요.')).toBeVisible();
    });

    it('preserves English copy for non-Korean locales', async () => {
        await i18n.changeLanguage('en');
        mount();
        expect(screen.getByText('No usage limit')).toBeInTheDocument();
        expect(screen.getByText('Room for 19 more staff')).toBeInTheDocument();
        expect(screen.getByRole('link', {name: 'Plans & additional uses'})).toBeInTheDocument();
    });
});
