import {existsSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {
    appRoot,
    catalogDir,
    catalogPath,
    ensureDir,
    flattenMessages,
    getNamespace,
    getOwner,
    getSurface,
    glossaryPath,
    loadTsModule,
    writeCsvRows,
} from './i18n-catalog-utils.mjs';

const localeDir = resolve(appRoot, 'src/shared/locales');
const importedAt = '2026-06-10';

const localeModules = {
    ko: loadTsModule(resolve(localeDir, 'ko.ts')).ko,
    en: loadTsModule(resolve(localeDir, 'en.ts')).en,
    ja: loadTsModule(resolve(localeDir, 'ja.ts')).ja,
    zh: loadTsModule(resolve(localeDir, 'zh.ts')).zh,
    th: loadTsModule(resolve(localeDir, 'th.ts')).th,
    vi: loadTsModule(resolve(localeDir, 'vi.ts')).vi,
};

const flatLocales = Object.fromEntries(
    Object.entries(localeModules).map(([locale, messages]) => [locale, flattenMessages(messages)]),
);

const runtimeKeys = Array.from(
    new Set(Object.values(flatLocales).flatMap((messages) => Object.keys(messages))),
).sort((left, right) => left.localeCompare(right));

const headers = [
    'messageId',
    'platform',
    'runtimeKey',
    'namespace',
    'owner',
    'surface',
    'status',
    'displayPolicy',
    'maxLength',
    'emptyLocales',
    'termIds',
    'context',
    'route',
    'component',
    'screenshotRef',
    'ko',
    'en',
    'ja',
    'zh',
    'th',
    'vi',
    'serverMessageKey',
    'updatedAt',
];

const rows = runtimeKeys.map((runtimeKey) => ({
    messageId: runtimeKey,
    platform: 'web',
    runtimeKey,
    namespace: getNamespace(runtimeKey),
    owner: getOwner(runtimeKey),
    surface: getSurface(runtimeKey),
    status: 'imported',
    displayPolicy: '',
    maxLength: '',
    emptyLocales: ['ko', 'en', 'ja', 'zh', 'th', 'vi'].filter((locale) => flatLocales[locale][runtimeKey] === '').join('|'),
    termIds: '',
    context: '',
    route: '',
    component: '',
    screenshotRef: '',
    ko: flatLocales.ko[runtimeKey] ?? '',
    en: flatLocales.en[runtimeKey] ?? '',
    ja: flatLocales.ja[runtimeKey] ?? '',
    zh: flatLocales.zh[runtimeKey] ?? '',
    th: flatLocales.th[runtimeKey] ?? '',
    vi: flatLocales.vi[runtimeKey] ?? '',
    serverMessageKey: '',
    updatedAt: importedAt,
}));

const termHeaders = [
    'termId',
    'ko',
    'en',
    'ja',
    'zh',
    'th',
    'vi',
    'description',
    'forbiddenEn',
    'forbiddenJa',
    'forbiddenZh',
    'forbiddenTh',
    'forbiddenVi',
];
const seedTerms = [
    {
        termId: 'ward',
        ko: '병동',
        en: 'Ward',
        ja: '病棟',
        zh: '病区',
        th: 'หอผู้ป่วย',
        vi: 'Khoa',
        description: '간호 운영 단위. 병원 부서 전체가 아니라 근무표를 공유하는 병동을 의미한다.',
        forbiddenEn: 'Department',
        forbiddenJa: '部署',
        forbiddenZh: '部门',
        forbiddenTh: 'แผนก',
        forbiddenVi: 'Phòng ban',
    },
    {
        termId: 'nurse',
        ko: '간호사',
        en: 'Nurse',
        ja: '看護師',
        zh: '护士',
        th: 'พยาบาล',
        vi: 'Điều dưỡng',
        description: '병동 근무표에 배정되는 구성원.',
        forbiddenEn: '',
        forbiddenJa: '',
        forbiddenZh: '',
        forbiddenTh: '',
        forbiddenVi: '',
    },
    {
        termId: 'shiftSchedule',
        ko: '근무표',
        en: 'Schedule',
        ja: '勤務表',
        zh: '排班表',
        th: 'ตารางเวร',
        vi: 'Lịch trực',
        description: '병동 근무 배정표. 화면 맥락에 따라 duty schedule 의미를 가진다.',
        forbiddenEn: 'Roster',
        forbiddenJa: 'シフト表',
        forbiddenZh: '值班表',
        forbiddenTh: '',
        forbiddenVi: '',
    },
    {
        termId: 'requestShift',
        ko: '신청 근무',
        en: 'Shift request',
        ja: '希望勤務',
        zh: '班次申请',
        th: 'คำขอเวร',
        vi: 'Yêu cầu ca trực',
        description: '간호사가 희망 근무 또는 휴무를 신청하는 기능.',
        forbiddenEn: 'Requested duty',
        forbiddenJa: '申請勤務',
        forbiddenZh: '值班申请',
        forbiddenTh: '',
        forbiddenVi: '',
    },
    {
        termId: 'confirmedSchedule',
        ko: '확정 근무표',
        en: 'Confirmed schedule',
        ja: '確定勤務表',
        zh: '已确认排班表',
        th: 'ตารางเวรที่ยืนยันแล้ว',
        vi: 'Lịch trực đã xác nhận',
        description: '관리자가 확정한 최종 근무표.',
        forbiddenEn: 'Final roster',
        forbiddenJa: '確定シフト',
        forbiddenZh: '最终值班表',
        forbiddenTh: '',
        forbiddenVi: '',
    },
    {
        termId: 'offShift',
        ko: '오프',
        en: 'Off',
        ja: '休み',
        zh: '休息',
        th: 'วันหยุด',
        vi: 'Nghỉ',
        description: '휴무 근무 유형. 병동 커스텀 근무 유형과 구분한다.',
        forbiddenEn: '',
        forbiddenJa: '',
        forbiddenZh: '',
        forbiddenTh: '',
        forbiddenVi: '',
    },
];

ensureDir(catalogDir);
writeFileSync(catalogPath, `${writeCsvRows(headers, rows)}\n`);

if (!existsSync(glossaryPath)) {
    ensureDir(dirname(glossaryPath));
    writeFileSync(glossaryPath, `${writeCsvRows(termHeaders, seedTerms)}\n`);
}

console.log(
    JSON.stringify(
        {
            catalogPath,
            glossaryPath,
            messages: rows.length,
            locales: Object.keys(localeModules),
        },
        null,
        2,
    ),
);
