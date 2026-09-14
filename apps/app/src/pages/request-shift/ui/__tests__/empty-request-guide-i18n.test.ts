import {afterAll, describe, expect, it} from 'vitest';
import i18n from '@/i18n';

const expectedGuides = {
    ko: {
        close: '안내 닫기',
        description: '간호사가 앱에서 원하는 근무를 보내면 이곳에서 한 번에 확인할 수 있어요.',
        directEntry: '직접 정하려면 다음 단계에서 입력할 수 있어요.',
        requestPageDirectEntry: '신청근무를 직접 등록하려면 ‘근무표 만들기’ 4단계에서 원하는 근무를 고정할 수 있어요.',
        title: '간호사에게 듀팅 앱으로 신청근무를 받아보세요',
    },
    en: {
        close: 'Close guide',
        description: 'Nurses can submit their preferred shifts in the app. Review them all here.',
        directEntry: 'To assign shifts yourself, enter them in the next step.',
        requestPageDirectEntry: 'To add shift requests manually, fix the shifts you want in step 4 of Create schedule.',
        title: 'Collect shift requests with the Dutying app',
    },
    ja: {
        close: '案内を閉じる',
        description: '看護師がアプリから希望勤務を送信するとここでまとめて確認できます。',
        directEntry: '直接決める場合は次のステップで入力できます。',
        requestPageDirectEntry: '希望勤務を直接登録する場合は「勤務表作成」のステップ4で希望する勤務を固定できます。',
        title: 'Dutyingアプリで看護師から希望勤務を受け取りましょう',
    },
    zh: {
        close: '关闭提示',
        description: '护士在 App 中提交希望的班次后，您可以在此统一查看。',
        directEntry: '如需自行安排，可在下一步直接录入。',
        requestPageDirectEntry: '如需手动登记班次申请，可在“创建排班表”的第 4 步固定所需班次。',
        title: '让护士通过 Dutying App 提交班次申请',
    },
    th: {
        close: 'ปิดคำแนะนำ',
        description: 'เมื่อพยาบาลส่งเวรที่ต้องการผ่านแอป คุณสามารถตรวจสอบทั้งหมดได้ที่นี่',
        directEntry: 'หากต้องการกำหนดเอง สามารถกรอกได้ในขั้นตอนถัดไป',
        requestPageDirectEntry: 'หากต้องการลงคำขอเวรด้วยตนเอง ให้ตรึงเวรที่ต้องการในขั้นตอนที่ 4 ของ “สร้างกำหนดการ”',
        title: 'รับคำขอเวรจากพยาบาลผ่านแอป Dutying',
    },
    vi: {
        close: 'Đóng hướng dẫn',
        description: 'Khi điều dưỡng gửi ca mong muốn trong ứng dụng, bạn có thể xem tất cả tại đây.',
        directEntry: 'Nếu muốn tự sắp xếp, bạn có thể nhập ở bước tiếp theo.',
        requestPageDirectEntry: 'Để tự đăng ký yêu cầu ca trực, hãy cố định ca mong muốn ở bước 4 của “Tạo lịch”.',
        title: 'Nhận yêu cầu ca trực từ điều dưỡng qua ứng dụng Dutying',
    },
} as const;

describe('empty request guide translations', () => {
    afterAll(async () => {
        await i18n.changeLanguage('ko');
    });

    it.each(Object.entries(expectedGuides))('provides the complete guide in %s without fallback text', async (language, expectedGuide) => {
        await i18n.changeLanguage(language);

        Object.entries(expectedGuide).forEach(([key, expectedText]) => {
            expect(i18n.t(`page.request.emptyGuide.${key}`)).toBe(expectedText);
        });
    });
});
