import {screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {DEFAULT_SKILL_LEVEL_CONFIG} from '@/features/ward-skill/model/skill-level';
import {render} from '@/shared/util/test-utils';
import MemberSkillLevelModal from '../member-skill-level-modal';

vi.mock('@/shared/hook/use-typed-translation', async () => {
    const {default: i18n} = await vi.importActual<typeof import('@/i18n')>('@/i18n');

    return {
        useTypedTranslation: () => ({
            t: (key: string, values?: Record<string, string | number>) => i18n.t(key, values),
        }),
    };
});

const renderModal = (enabled: boolean) =>
    render(
        <MemberSkillLevelModal
            open
            config={{...DEFAULT_SKILL_LEVEL_CONFIG, enabled}}
            onClose={vi.fn()}
            onSave={vi.fn()}
            onDisable={vi.fn()}
        />,
    );

describe('MemberSkillLevelModal', () => {
    it('숙련도 사용 중이면 사용하지 않기 버튼을 보여준다', () => {
        renderModal(true);

        expect(screen.getByRole('button', {name: '숙련도 사용하지 않기'})).toBeInTheDocument();
    });

    it('숙련도를 이미 사용하지 않는 상태면 사용하지 않기 버튼을 숨긴다', () => {
        renderModal(false);

        expect(screen.queryByRole('button', {name: '숙련도 사용하지 않기'})).not.toBeInTheDocument();
    });
});
