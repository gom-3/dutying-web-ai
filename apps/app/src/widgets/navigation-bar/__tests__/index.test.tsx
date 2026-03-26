import {MemoryRouter, Route, Routes} from 'react-router';
import {describe, expect, it} from 'vitest';
import ROUTE from '@/shared/constant/path';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import NavigationBar from '..';

describe('NavigationBar', () => {
    it('설정 섹션에 계정 관리 메뉴를 노출하고 하단 프로필 영역은 렌더링하지 않는다', () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.MAKE]}>
                <NavigationBar />
            </MemoryRouter>,
        );

        expect(screen.getByRole('button', {name: '계정 관리'})).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('계정 관리 메뉴를 클릭하면 프로필 페이지로 이동한다', async () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.MAKE]}>
                <Routes>
                    <Route
                        path={ROUTE.MAKE}
                        element={
                            <div className="flex">
                                <NavigationBar />
                                <div>make page</div>
                            </div>
                        }
                    />
                    <Route
                        path={ROUTE.PROFILE}
                        element={
                            <div className="flex">
                                <NavigationBar />
                                <div>profile page</div>
                            </div>
                        }
                    />
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByText('make page')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: '계정 관리'}));

        expect(await screen.findByText('profile page')).toBeInTheDocument();
    });
});
