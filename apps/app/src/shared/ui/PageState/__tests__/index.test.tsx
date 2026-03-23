import {describe, expect, it, vi} from 'vitest';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import PageState from '../index';

describe('PageState 컴포넌트', () => {
    it('loading 상태에서 title과 description을 렌더링한다', () => {
        render(<PageState tone="loading" title="불러오는 중" description="잠시만 기다려 주세요." />);

        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.getByText('불러오는 중')).toBeInTheDocument();
        expect(screen.getByText('잠시만 기다려 주세요.')).toBeInTheDocument();
    });

    it('error 상태에서 재시도 액션을 실행한다', async () => {
        const onClick = vi.fn();
        const user = userEvent.setup();

        render(<PageState tone="error" title="오류가 발생했어요" action={{label: '다시 시도', onClick}} />);

        const button = screen.getByRole('button', {name: '다시 시도'});

        expect(button).toHaveClass('h-11', 'rounded-[14px]');

        await user.click(button);

        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
