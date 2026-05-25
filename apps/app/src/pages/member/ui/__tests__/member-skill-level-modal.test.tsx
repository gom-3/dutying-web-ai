import {screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {DEFAULT_SKILL_LEVEL_CONFIG} from '@/features/ward-skill/model/skill-level';
import {render} from '@/shared/util/test-utils';
import MemberSkillLevelModal from '../member-skill-level-modal';

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string, values?: Record<string, number>) => {
            if (key === 'page.member.skillLevelModal.levelCountOption') {
                return `${values?.levelCount ?? ''}단계`;
            }

            const labels: Record<string, string> = {
                'page.member.skillLevelModal.categoryLabel': '구분',
                'page.member.skillLevelModal.close': '닫기',
                'page.member.skillLevelModal.colorLabel': '색상',
                'page.member.skillLevelModal.complete': '완료',
                'page.member.skillLevelModal.description': '숙련도 기준, 단계, 용어, 색상은 자유롭게 맞춤 설정할 수 있어요',
                'page.member.skillLevelModal.high': '높음',
                'page.member.skillLevelModal.levelLabel': '숙련도',
                'page.member.skillLevelModal.low': '낮음',
                'page.member.skillLevelModal.title': '숙련도 단계 설정',
            };

            return labels[key] ?? key;
        },
    }),
}));

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
