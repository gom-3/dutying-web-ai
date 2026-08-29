import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router';
import {describe, expect, it, vi} from 'vitest';
import ROUTE from '@/shared/constant/path';
import Tutorial from '../index';

vi.mock('../MemberTutorial', () => ({
    default: () => <div>member tutorial</div>,
}));

vi.mock('../RequestTutorial', () => ({
    default: () => <div>request tutorial</div>,
}));

describe('Tutorial', () => {
    it('renders member tutorial on member route', async () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.MEMBER]}>
                <Tutorial />
            </MemoryRouter>,
        );

        // Tutorial 은 하위 컴포넌트를 lazy 로 싣는다. 첫 렌더에는 Suspense fallback(null)만
        // 있으므로 getByText 로는 못 잡는다.
        expect(await screen.findByText('member tutorial')).toBeInTheDocument();
    });

    it('renders request tutorial on request route', async () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.REQUEST]}>
                <Tutorial />
            </MemoryRouter>,
        );

        // Tutorial 은 하위 컴포넌트를 lazy 로 싣는다. 첫 렌더에는 Suspense fallback(null)만
        // 있으므로 getByText 로는 못 잡는다.
        expect(await screen.findByText('request tutorial')).toBeInTheDocument();
    });

    it('renders nothing on unsupported route', () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.DUTY]}>
                <Tutorial />
            </MemoryRouter>,
        );

        expect(screen.queryByText('request tutorial')).not.toBeInTheDocument();
        expect(screen.queryByText('member tutorial')).not.toBeInTheDocument();
    });
});
