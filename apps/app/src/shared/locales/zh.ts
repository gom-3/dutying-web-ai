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
        login: {
            ...generatedZh.page.login,
            lineContinue: '继续使用 LINE',
            lineStart: '开始使用 LINE',
        },
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
            aiRefill: {
                ...generatedZh.page.makeShift.aiRefill,
                adjust: {
                    title: '可以这样说',
                    examplesMore: '更多示例',
                    examplesLess: '收起',
                    inputHint: '约束条件里能写的，这里都能说。加上姓名、班次(D/E/N/O)和数字会更准确。',
                    examples: {
                        clusterOn: '把班排得连在一起，休息也连着两天',
                        clusterOff: '减少连续上班，让休息更分散一些',
                        offBalance: '让每个人的休息天数更平均',
                        seniorityMix: '同一个班不要都是新人，把熟练度混一混',
                        maxConsecutiveDay: '白班最多连上4天',
                        maxConsecutiveNight: '夜班最多连上3天',
                        maxConsecutiveWork: '最多连上5天班，之后要休息',
                        offAfterNight: '夜班结束后休息两天',
                        noIsolatedOff: '不要只休一天，至少连休两天',
                        forbidNightThenDay: '夜班第二天不要排白班',
                        forbidEveningThenDay: '小夜第二天尽量不排白班',
                        monthlyNightCap: '每人每月夜班最多6次',
                        weekendCap: '每人周末班最多3次',
                        nurseAvoidShift: '○○这个月不要排小夜',
                        nurseForbidWeekend: '○○周末不要排班',
                        pairNotSameShift: '○○和△△不要排同一个班',
                        combined: '夜班后休两天，白班最多连上4天',
                    },
                    severity: {
                        SOFT: '建议',
                        HARD: '必须',
                        label: '{{label}} 强度',
                    },
                    promote: {
                        title: '这些规则下个月还用吗？',
                        description: '这是您这个月用句子设置的规则。只有选择保留的会成为病区约束条件，其余到本月为止。',
                        keep: '保留',
                        discard: '仅本月',
                        confirm: '确定',
                        cancel: '取消',
                    },
                    monthRuleBadge: '本月规则',
                    remaining: '“{{label}}”还有{{count}}处没满足。',
                    remainingAction: '调整得更强',
                    downgraded: '“{{label}}”设成了必须，但这个月没能完全满足。',
                    useSuggestion: '用这句话',
                    applied: '已更改 {{count}} 个单元格。',
                    noChange: '在该方向上已是最优。',
                    failed: '无法调整，请稍后重试。',
                    notAllowed: '该功能尚未对此账号开放。',
                    textInput: {
                        label: '调整请求',
                        placeholder: '例如：休息更均匀一些，班次集中安排',
                        submit: '调整',
                        interpreting: '理解中…',
                    },
                    interpretFailed: '无法理解这句话，请稍后重试。',
                    lifetime: {
                        MONTH: '仅本月',
                        TEAM: '持续',
                    },
                    card: {
                        title: '我们是这样理解的',
                        empty: '无法转换为调整方向。试试用休息、班次集中、资历搭配来描述。',
                        lifetimeLabel: '{{label}} 期限',
                        teamHint: '看起来会持续使用',
                        ruleNote: '可以设为规则 — 本次调整不会应用。',
                        apply: '应用',
                        cancel: '取消',
                    },
                    requests: {
                        title: '本月请求 {{count}} 条',
                        empty: '还没有请求。',
                        persistNote: '重新生成后这些请求仍会保留，并在每次自动填充和调整时一起应用。',
                        remove: '关闭 {{label}}',
                        carriedOver: '来自上月',
                    },
                    carryOver: {
                        title: '上个月有这些请求',
                        description: '请选择本月也要保留的请求。',
                        yes: '本月也要',
                        no: '不要',
                        apply: '应用',
                        skip: '跳过',
                        applied: '已将 {{count}} 条请求带入本月。',
                        failed: '无法带入，请稍后重试。',
                    },
                },
            },
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
