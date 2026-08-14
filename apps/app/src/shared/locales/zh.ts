import {zh as generatedZh} from '../i18n/resources.generated';
import {type TLocale} from './ko';

export const zh = {
    ...generatedZh,
    widget: {
        ...generatedZh.widget,
        wardChat: {
            ...generatedZh.widget.wardChat,
            enableAlertAria: '开启病区聊天新消息提醒',
            disableAlertAria: '关闭病区聊天新消息提醒',
            alertOnTooltip: '新消息提醒已开启',
            alertOffTooltip: '新消息提醒已关闭',
            previewOpenAria: '打开来自 {{sender}} 的新消息：{{text}}',
            unknownSender: '病区聊天',
            emptyPreview: '收到一条新消息。',
            photoPreview: '发送了一张照片。',
            addImageAria: '添加照片',
            addImageTitle: '添加照片',
            removeImageAria: '删除 {{name}} 照片',
            removeImageTitle: '删除照片',
            imageUploadingAria: '正在上传照片',
            imagePreviewAria: '预览照片 {{index}}/{{total}}',
            imagePreviewTitle: '照片预览',
            closeImagePreviewAria: '关闭照片预览',
            imageFallbackName: '照片',
            toast: {
                ...generatedZh.widget.wardChat.toast,
                imageUploadFailed: '照片上传失败，请重试。',
                maxImageCount: '最多可发送 {{count}} 张照片。',
                maxImageSize: '图片文件必须小于 {{size}}MB。',
                imageOnly: '只能上传图片文件。',
            },
        },
    },
    page: {
        ...generatedZh.page,
        notifications: {
            openAria: '打开通知',
            panelAria: '通知列表',
            title: '通知',
            unreadCount: '{{count}} 条未读通知',
            unreadShort: '未读 {{count}}',
            justNow: '刚刚',
            minutesAgo: '{{count}} 分钟前',
            hoursAgo: '{{count}} 小时前',
            loadFailed: '无法加载通知。',
            retry: '重试',
            empty: '没有新通知。',
        },
        profile: {
            ...generatedZh.page.profile,
            birthDate: '出生日期',
            validation: {
                ...generatedZh.page.profile.validation,
                birthDateInvalid: '请输入 1900-01-01 至今天之间的日期。',
            },
        },
        member: {
            ...generatedZh.page.member,
            detail: {
                ...generatedZh.page.member.detail,
                shiftRatio: '月度班次比例',
                shiftRatioHelpAria: '月度班次比例说明',
                shiftRatioHint: '仅按可排班的D/E/N/O班次调整月度目标天数',
                shiftRatioEmpty: '选择可排班的D/E/N/O班次后即可设置比例',
                shiftRatioInputAria: '{{shiftName}}月度班次天数',
                shiftRatioReset: '展开月度班次比例',
            },
        },
        makeShift: {
            ...generatedZh.page.makeShift,
            calendar: {
                ...generatedZh.page.makeShift.calendar,
                fixCell: '固定',
                unfixCell: '取消固定',
                fixCellSuccess: '已固定班次。',
                unfixCellSuccess: '已取消固定班次。',
                fixedStatusPin: '固定班次',
                requestStatusPin: '申请班次',
            },
            context: {
                switchToast: '已切换到 {{year}}年{{month}}月 · {{teamName}}。',
            },
            constraints: {
                ...generatedZh.page.makeShift.constraints,
                toast: {
                    ...generatedZh.page.makeShift.constraints.toast,
                    duplicateSkipped: '相同条件已存在。',
                    staffCountConflict: '相同适用日和班次的最少、最多和精确人数条件相互冲突。',
                },
                savedWarnings: {
                    title: '已保存，但有些约束条件需要确认',
                },
                staffCountText: {
                    min: '{{dateScope}}的{{shift}}班次至少需要{{count}}名护士。',
                    max: '{{dateScope}}的{{shift}}班次最多可安排{{count}}名护士。',
                    exact: '{{dateScope}}的{{shift}}班次必须正好安排{{count}}名护士。',
                },
                category: {
                    ...generatedZh.page.makeShift.constraints.category,
                    workRestStreaks: '连续工作与休息',
                    nightTransition: '夜班与转换',
                    roleCoverage: '技能与角色',
                },
                option: {
                    ...generatedZh.page.makeShift.constraints.option,
                    monthlyDayLabel: '每月{{day}}日',
                    everyday: '每天',
                    weekday: '工作日',
                    weekend: '周末',
                    holiday: '节假日',
                    weekendOrHoliday: '周末/节假日',
                    weekdayName: {
                        monday: '星期一',
                        tuesday: '星期二',
                        wednesday: '星期三',
                        thursday: '星期四',
                        friday: '星期五',
                        saturday: '星期六',
                        sunday: '星期日',
                    },
                    target: {
                        rotating: '普通三班制护士',
                        nightDedicated: '专职夜班护士',
                    },
                    staffCountOperator: {
                        min: '至少',
                        max: '最多',
                        exact: '正好',
                    },
                },
                templates: {
                    CORE_MAX_CONTINUOUS_WORK: {
                        label: '重要基础条件',
                        sentence: '{target}最多可连续工作{count}天',
                    },
                    CORE_MIN_NIGHT_INTERVAL: {
                        label: '重要基础条件',
                        sentence: '{target}的N班之间至少需要间隔{count}天',
                    },
                    CORE_MAX_CONTINUOUS_NIGHT: {
                        label: '重要基础条件',
                        sentence: '{target}连续N班最多只能安排{count}次',
                    },
                    CORE_MIN_CONTINUOUS_NIGHT: {
                        label: '夜班与转换条件',
                        sentence: '{target}至少连续安排{count}天N班',
                    },
                    CORE_MIN_OFF_AFTER_NIGHT: {
                        label: '重要基础条件',
                        sentence: '{target}在N班后至少需要{count}天休息',
                    },
                    CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF: {
                        label: '重要基础条件',
                        sentence: '{target}在申请休息日的前一天不能安排N班',
                    },
                    STAFF_COUNT_BY_SHIFT: {
                        label: '人数条件',
                        sentence: '{dateScope}的{shift}班人数必须{operator}{count}人',
                    },
                    MIN_STAFF_BY_SHIFT: {
                        label: '人数条件',
                        sentence: '{shift}班至少需要{count}人',
                    },
                    MAX_STAFF_BY_SHIFT: {
                        label: '人数条件',
                        sentence: '{shift}班最多可安排{count}人',
                    },
                    MIN_STAFF_BY_DATE_SHIFT: {
                        label: '人数条件',
                        sentence: '每月{date}日的{shift}班至少需要{count}人',
                    },
                    MIN_STAFF_WEEKEND_HOLIDAY_SHIFT: {
                        label: '人数条件',
                        sentence: '周末和节假日的{shift}班至少需要{count}人',
                    },
                    MAX_CONSECUTIVE_WORK_DAYS: {
                        label: '工作休息条件',
                        sentence: '{target}最多可连续工作{count}天',
                    },
                    OFF_AFTER_CONSECUTIVE_WORK: {
                        label: '工作休息条件',
                        sentence: '{target}连续工作{count}天后需要休息',
                    },
                    MIN_OFF_AFTER_N: {
                        label: '工作休息条件',
                        sentence: '{target}在N班后至少需要{count}天休息',
                    },
                    MIN_MONTHLY_OFF: {
                        label: '工作休息条件',
                        sentence: '{target}每月至少需要{count}天休息',
                    },
                    NURSE_FORBID_WEEKEND: {
                        label: '个人条件',
                        sentence: '{nurse}不能在周末或节假日工作',
                    },
                    NURSE_PREFER_SHIFT: {
                        label: '个人条件',
                        sentence: '{nurse}偏好{shift}班',
                    },
                    NURSE_AVOID_SHIFT: {
                        label: '个人条件',
                        sentence: '{nurse}希望避免{shift}班',
                    },
                    MIN_OFF_AFTER_CONSECUTIVE_WORK: {
                        label: '连续工作与休息条件',
                        sentence: '{target}连续工作至少{workCount}天后休息至少{offCount}天',
                    },
                    AVOID_ISOLATED_WORK_DAY: {
                        label: '连续工作与休息条件',
                        sentence: '{target}避免在两个休息日之间只工作一天',
                    },
                    AVOID_ISOLATED_OFF_DAY: {
                        label: '连续工作与休息条件',
                        sentence: '{target}避免在两个工作日之间只休息一天',
                    },
                    MAX_MONTHLY_NIGHT_COUNT: {
                        label: '夜班与转换条件',
                        sentence: '{target}每月最多安排{count}次夜班',
                    },
                    NURSE_MAX_WEEKEND_HOLIDAY_SHIFTS: {
                        label: '个人限制',
                        sentence: '{target}在{period}内最多安排{count}次周末或节假日{shift}班',
                    },
                    PRECEPTEE_NOT_ALONE_SHIFT: {
                        label: '技能与角色',
                        sentence: '{preceptee}上班时，在同一班次安排另一名护士',
                    },
                    PRECEPTOR_PRECEPTEE_SAME_SHIFT: {
                        label: '技能与角色',
                        sentence: '将{preceptor}和{preceptee}安排在同一班次',
                    },
                    IMPORTANT_MAX_WORK_STREAK: {
                        label: '重要基础条件',
                        sentence: '连续工作最多允许{days}天',
                    },
                    IMPORTANT_MAX_SAME_DUTY_STREAK: {
                        label: '重要基础条件',
                        sentence: '同一班次连续工作最多允许{days}天',
                    },
                    IMPORTANT_MIN_NIGHT_INTERVAL: {
                        label: '重要基础条件',
                        sentence: 'N班之间至少需要间隔{days}天',
                    },
                    IMPORTANT_MAX_NIGHT_STREAK: {
                        label: '重要基础条件',
                        sentence: '连续N班最多允许{days}天',
                    },
                    IMPORTANT_OFF_AFTER_NIGHT: {
                        label: '重要基础条件',
                        sentence: 'N班后至少需要{days}天OFF',
                    },
                    IMPORTANT_NO_NIGHT_BEFORE_REQUEST_OFF: {
                        label: '重要基础条件',
                        sentence: '申请OFF的前一天不能安排N班',
                    },
                    IMPORTANT_FORBIDDEN_DUTY_PATTERNS: {
                        label: '重要基础条件',
                        sentence: '避免ND / NE / ED / EN / NOD组合',
                    },
                    SOFT_MIN_STAFF_BY_DUTY: {
                        label: '人数条件',
                        sentence: '{duty}班至少需要{count}人',
                    },
                    SOFT_MAX_STAFF_BY_DUTY: {
                        label: '人数条件',
                        sentence: '{duty}班最多可安排{count}人',
                    },
                    SOFT_MIN_STAFF_BY_DATE_DUTY: {
                        label: '人数条件',
                        sentence: '{date}的{duty}班至少需要{count}人',
                    },
                    SOFT_MIN_STAFF_WEEKEND_HOLIDAY: {
                        label: '人数条件',
                        sentence: '周末和节假日的{duty}班至少需要{count}人',
                    },
                    SOFT_NO_N_TO_D: {
                        label: '禁止模式条件',
                        sentence: '{target}避免N班次日安排D班',
                    },
                    SOFT_NO_N_TO_E: {
                        label: '禁止模式条件',
                        sentence: '{target}避免N班次日安排E班',
                    },
                    SOFT_NO_E_TO_D: {
                        label: '禁止模式条件',
                        sentence: '{target}避免E班次日安排D班',
                    },
                    SOFT_NO_E_TO_N: {
                        label: '禁止模式条件',
                        sentence: '{target}避免E班次日安排N班',
                    },
                    SOFT_MAX_CONSECUTIVE_N: {
                        label: '禁止模式条件',
                        sentence: '{target}连续N班最多{count}次',
                    },
                    SOFT_MAX_CONSECUTIVE_WORK: {
                        label: '工作休息条件',
                        sentence: '{target}连续工作最多{days}天',
                    },
                    SOFT_NEED_OFF_AFTER_CONSECUTIVE: {
                        label: '工作休息条件',
                        sentence: '{target}连续工作{days}天后需要OFF',
                    },
                    SOFT_NEED_OFF_AFTER_N: {
                        label: '工作休息条件',
                        sentence: '{target}在N班后至少需要{days}天OFF',
                    },
                    SOFT_MIN_MONTHLY_OFF: {
                        label: '工作休息条件',
                        sentence: '{target}每月至少需要{days}天OFF',
                    },
                    SOFT_NO_WEEKEND_FOR_NURSE: {
                        label: '个人条件',
                        sentence: '{nurse}不能在周末或节假日工作',
                    },
                    SOFT_NO_SAME_DUTY_PAIR: {
                        label: '组合条件',
                        sentence: '{nurseA}和{nurseB}不能安排相同班次',
                    },
                    SOFT_PREFER_SAME_DUTY_PAIR: {
                        label: '组合条件',
                        sentence: '{nurseA}最好与{nurseB}安排相同班次',
                    },
                },
            },
        },
    },
    feature: {
        ...generatedZh.feature,
        account: {
            ...generatedZh.feature.account,
            edit: {
                ...generatedZh.feature.account.edit,
                birthDateFailed: '无法保存出生日期。',
            },
        },
    },
} as unknown as TLocale;
