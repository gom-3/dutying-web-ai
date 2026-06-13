import {act} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {useLoadingStore} from '@/features/loading/model/store';
import {render, screen} from '@/shared/util/test-utils';
import Loading from '../loading';

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe('Loading widget', () => {
    afterEach(() => {
        act(() => {
            useLoadingStore.getState().setLoading(false);
        });
    });

    it('renders the default loading style as a dim full-screen overlay', () => {
        act(() => {
            useLoadingStore.getState().setLoading(true);
        });

        render(<Loading />);

        const overlay = screen.getByText('page.state.loadingTitle').closest('.fixed');

        expect(overlay).toHaveClass('inset-0', 'bg-[#0000006e]', 'backdrop-blur-[1px]');
    });
});
