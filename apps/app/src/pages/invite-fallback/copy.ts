import type {TPreferredLanguage} from '@dutying/domain';
import type {TInviteKind} from '@/shared/config/invite';

type TInviteCopy = {
    pageTitle: string;
    title: string;
    description: string;
    codeLabel: string;
    openButtonLabel: string;
};
type TInvitePageCopy = {
    homeLabel: string;
    openHint: string;
    downloadTitle: string;
    downloadDescription: string;
    downloadLabel: string;
    invites: Record<TInviteKind, TInviteCopy>;
};

export const INVITE_PAGE_COPY: Record<TPreferredLanguage, TInvitePageCopy> = {
    ko: {
        homeLabel: '듀팅 홈',
        openHint: '앱이 바로 열리지 않나요?\n아래 버튼으로 초대를 확인하세요.',
        downloadTitle: '듀팅 앱이\n아직 없다면?',
        downloadDescription: '앱을 설치한 뒤 이 초대 링크를 다시 열어주세요.',
        downloadLabel: '앱 설치 안내',
        invites: {
            friend: {
                pageTitle: '친구 초대 열기 | 듀팅',
                title: '친구와 근무 일정을\n함께 확인해요',
                description: '듀팅 앱에서 친구 초대를 이어서 확인하세요.',
                codeLabel: '친구 코드',
                openButtonLabel: '듀팅 앱에서 친구 추가하기',
            },
            moim: {
                pageTitle: '모임 초대 열기 | 듀팅',
                title: '모임 멤버와 일정을\n함께 확인해요',
                description: '듀팅 앱에서 모임 초대를 이어서 확인하세요.',
                codeLabel: '모임 코드',
                openButtonLabel: '듀팅 앱에서 모임 초대 확인하기',
            },
        },
    },
    ja: {
        homeLabel: 'Dutyingのホーム',
        openHint: 'アプリが開きませんか？\n下のボタンから招待を確認してください。',
        downloadTitle: 'Dutyingアプリを\nまだお持ちでない方へ',
        downloadDescription: 'アプリをインストールした後、この招待リンクをもう一度開いてください。',
        downloadLabel: 'アプリのインストール案内',
        invites: {
            friend: {
                pageTitle: '友だちの招待を開く | Dutying',
                title: '友だちと勤務予定を\n一緒に確認しましょう',
                description: 'Dutyingアプリで友だちの招待を確認してください。',
                codeLabel: '友だちコード',
                openButtonLabel: 'Dutyingアプリで友だちを追加',
            },
            moim: {
                pageTitle: 'グループの招待を開く | Dutying',
                title: 'グループのメンバーと\n予定を確認しましょう',
                description: 'Dutyingアプリでグループの招待を確認してください。',
                codeLabel: 'グループコード',
                openButtonLabel: 'Dutyingアプリでグループの招待を確認',
            },
        },
    },
    en: {
        homeLabel: 'Dutying home',
        openHint: 'App not opening?\nUse the button below to view your invitation.',
        downloadTitle: 'Don’t have the\nDutying app yet?',
        downloadDescription: 'Install the app, then open this invitation link again.',
        downloadLabel: 'App installation guide',
        invites: {
            friend: {
                pageTitle: 'Open friend invitation | Dutying',
                title: 'Keep up with your\nfriends’ work schedules',
                description: 'View your friend invitation in the Dutying app.',
                codeLabel: 'Friend code',
                openButtonLabel: 'Add friend in Dutying',
            },
            moim: {
                pageTitle: 'Open group invitation | Dutying',
                title: 'See your group’s\nschedules together',
                description: 'View your group invitation in the Dutying app.',
                codeLabel: 'Group code',
                openButtonLabel: 'View group invitation in Dutying',
            },
        },
    },
    zh: {
        homeLabel: 'Dutying 首页',
        openHint: '应用没有打开？\n请点击下方按钮查看邀请。',
        downloadTitle: '还没有安装\nDutying 应用？',
        downloadDescription: '安装应用后，请重新打开此邀请链接。',
        downloadLabel: '应用安装指南',
        invites: {
            friend: {
                pageTitle: '打开好友邀请 | Dutying',
                title: '与好友一起\n查看工作日程',
                description: '请在 Dutying 应用中查看好友邀请。',
                codeLabel: '好友代码',
                openButtonLabel: '在 Dutying 应用中添加好友',
            },
            moim: {
                pageTitle: '打开群组邀请 | Dutying',
                title: '与群组成员一起\n查看日程',
                description: '请在 Dutying 应用中查看群组邀请。',
                codeLabel: '群组代码',
                openButtonLabel: '在 Dutying 应用中查看群组邀请',
            },
        },
    },
    th: {
        homeLabel: 'หน้าหลัก Dutying',
        openHint: 'แอปไม่เปิดใช่ไหม?\nกดปุ่มด้านล่างเพื่อดูคำเชิญ',
        downloadTitle: 'ยังไม่มีแอป\nDutying ใช่ไหม?',
        downloadDescription: 'ติดตั้งแอปแล้วเปิดลิงก์คำเชิญนี้อีกครั้ง',
        downloadLabel: 'คำแนะนำการติดตั้งแอป',
        invites: {
            friend: {
                pageTitle: 'เปิดคำเชิญเป็นเพื่อน | Dutying',
                title: 'ดูตารางงาน\nร่วมกับเพื่อน',
                description: 'ดูคำเชิญเป็นเพื่อนในแอป Dutying',
                codeLabel: 'รหัสเพื่อน',
                openButtonLabel: 'เพิ่มเพื่อนในแอป Dutying',
            },
            moim: {
                pageTitle: 'เปิดคำเชิญเข้ากลุ่ม | Dutying',
                title: 'ดูตารางเวลา\nร่วมกับสมาชิกในกลุ่ม',
                description: 'ดูคำเชิญเข้ากลุ่มในแอป Dutying',
                codeLabel: 'รหัสกลุ่ม',
                openButtonLabel: 'ดูคำเชิญเข้ากลุ่มในแอป Dutying',
            },
        },
    },
    vi: {
        homeLabel: 'Trang chủ Dutying',
        openHint: 'Ứng dụng chưa mở?\nNhấn nút bên dưới để xem lời mời.',
        downloadTitle: 'Bạn chưa có\nứng dụng Dutying?',
        downloadDescription: 'Cài đặt ứng dụng rồi mở lại liên kết lời mời này.',
        downloadLabel: 'Hướng dẫn cài đặt ứng dụng',
        invites: {
            friend: {
                pageTitle: 'Mở lời mời kết bạn | Dutying',
                title: 'Cùng bạn bè\nxem lịch làm việc',
                description: 'Xem lời mời kết bạn trong ứng dụng Dutying.',
                codeLabel: 'Mã bạn bè',
                openButtonLabel: 'Thêm bạn trong Dutying',
            },
            moim: {
                pageTitle: 'Mở lời mời vào nhóm | Dutying',
                title: 'Cùng các thành viên\nxem lịch của nhóm',
                description: 'Xem lời mời vào nhóm trong ứng dụng Dutying.',
                codeLabel: 'Mã nhóm',
                openButtonLabel: 'Xem lời mời vào nhóm trong Dutying',
            },
        },
    },
};
