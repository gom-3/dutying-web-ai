import {fireEvent, render, screen} from '@testing-library/react';
import {act} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {AiAdjustInterpretCard} from '@/pages/make-shift/ui/steps/ai-auto-fill/ai-adjust-interpret-card';
import {OnboardingAddDivisionButton, OnboardingDivisionHeader} from '@/pages/onboarding-ward-create/ui/steps/division-controls';
import {getDivisionCustomName, getDivisionDisplayLabel} from '@/shared/lib/division-label';

const languages = [
    ['ko', '그룹1', '그룹 추가', '그룹 삭제'],
    ['en', 'Group 1', 'Add group', 'Delete group'],
    ['ja', 'グループ1', 'グループを追加', 'グループを削除'],
    ['zh', '小组1', '添加小组', '删除小组'],
    ['zh-TW', '小組1', '新增小組', '刪除小組'],
    ['th', 'กลุ่ม 1', 'เพิ่มกลุ่ม', 'ลบกลุ่ม'],
    ['vi', 'Nhóm 1', 'Thêm nhóm', 'Xóa nhóm'],
] as const;
const headerProps = {
    divisionNum: 1,
    divisionName: '그룹1',
    itemCount: 15,
    isEditing: false,
    draftName: '',
    canDelete: true,
    onStartEdit: vi.fn(),
    onDraftNameChange: vi.fn(),
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    onDelete: vi.fn(),
};

describe('group internationalization', () => {
    afterEach(async () => {
        await act(async () => {
            await i18n.changeLanguage('ko');
        });
    });

    it.each(languages)('renders stored defaults and group controls in %s', async (language, label, add, remove) => {
        await i18n.changeLanguage(language);

        const view = render(
            <>
                <OnboardingDivisionHeader {...headerProps} />
                <OnboardingAddDivisionButton onClick={vi.fn()} />
            </>,
        );

        expect(screen.getByTitle(label)).toHaveTextContent(label);
        expect(screen.getByRole('button', {name: add})).toBeInTheDocument();
        expect(screen.getByTitle(remove)).toHaveTextContent(remove);

        for (const name of [undefined, null, '', '  ', '그룹1', ' 그룹1 ']) {
            expect(getDivisionDisplayLabel(1, name, i18n.t.bind(i18n))).toBe(label);
        }

        for (const name of ['나이트킵', '田代チーム', 'Group A', '그룹12']) {
            expect(getDivisionDisplayLabel(1, name, i18n.t.bind(i18n))).toBe(name);
        }

        view.rerender(<OnboardingDivisionHeader {...headerProps} isEditing />);
        expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', label);

        const messages = i18n.getResource(language, 'translation', 'shared.division') as Record<string, string>;

        expect(Object.keys(messages)).toHaveLength(12);

        for (const message of Object.values(messages)) {
            expect(message.trim()).not.toBe('');

            if (language !== 'ko') expect(message).not.toMatch(/[가-힣]/);
        }
    });

    it('updates an already mounted header when switching languages without changing a custom name', async () => {
        const view = render(<OnboardingDivisionHeader {...headerProps} />);

        await act(async () => {
            await i18n.changeLanguage('ja-JP');
        });
        expect(screen.getByTitle('グループ1')).toBeInTheDocument();
        fireEvent.click(screen.getByTitle('グループを削除'));
        expect(headerProps.onDelete).toHaveBeenCalled();

        view.rerender(<OnboardingDivisionHeader {...headerProps} divisionName="나이트킵" />);
        await act(async () => {
            await i18n.changeLanguage('en');
        });
        expect(screen.getByTitle('나이트킵')).toBeInTheDocument();
        expect(getDivisionCustomName(1, '그룹1')).toBe('');
        expect(getDivisionCustomName(1, '나이트킵')).toBe('나이트킵');
    });

    it.each(languages)('localizes default names previously saved in any supported language in %s', async (language, label) => {
        await i18n.changeLanguage(language);

        for (const [, storedLabel] of languages) {
            expect(getDivisionDisplayLabel(1, storedLabel, i18n.t.bind(i18n))).toBe(label);
            expect(getDivisionCustomName(1, storedLabel)).toBe('');
        }
    });

    it.each(languages)('localizes a stored default group in the AI target summary in %s', async (language, label) => {
        await i18n.changeLanguage(language);

        const names = ['Nurse A', 'Nurse B'];

        render(
            <AiAdjustInterpretCard
                nurses={names.map((name, index) => ({nurseId: index + 1, name, divisionNum: 1, divisionName: '그룹1'}))}
                card={{
                    requestText: 'Example',
                    items: [
                        {
                            item: {
                                kind: 'RULE',
                                templateCode: 'MAX_CONSECUTIVE_SHIFT',
                                params: {target: [1, 2], shift: 'N', count: 4},
                                requiresConfirmation: false,
                            },
                            lifetime: 'MONTH',
                            severity: 'SOFT',
                        },
                    ],
                    unmapped: [],
                    strength: 'NORMAL',
                }}
            />,
        );

        const summary = i18n.t('aiAutofillUi.interpretCard.targetGroup', {prefix: label, count: 2, names: names.join(', ')});

        expect(
            screen.getByText((_, element) => element?.tagName === 'P' && element.textContent?.endsWith(summary) === true),
        ).toBeInTheDocument();
    });
});
