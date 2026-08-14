import {vi as generatedVi} from '../i18n/resources.generated';
import {type TLocale} from './ko';

export const vi = {
    ...generatedVi,
    widget: {
        ...generatedVi.widget,
        wardChat: {
            ...generatedVi.widget.wardChat,
            enableAlertAria: 'Bật thông báo tin nhắn mới trong trò chuyện khoa',
            disableAlertAria: 'Tắt thông báo tin nhắn mới trong trò chuyện khoa',
            alertOnTooltip: 'Thông báo tin nhắn mới đang bật',
            alertOffTooltip: 'Thông báo tin nhắn mới đang tắt',
            previewOpenAria: 'Mở tin nhắn mới từ {{sender}}: {{text}}',
            unknownSender: 'Trò chuyện khoa',
            emptyPreview: 'Có tin nhắn mới.',
            photoPreview: 'Đã gửi một ảnh.',
            addImageAria: 'Thêm ảnh',
            addImageTitle: 'Thêm ảnh',
            removeImageAria: 'Xóa ảnh {{name}}',
            removeImageTitle: 'Xóa ảnh',
            imageUploadingAria: 'Đang tải ảnh lên',
            imagePreviewAria: 'Xem trước ảnh {{index}}/{{total}}',
            imagePreviewTitle: 'Xem trước ảnh',
            closeImagePreviewAria: 'Đóng xem trước ảnh',
            imageFallbackName: 'Ảnh',
            toast: {
                ...generatedVi.widget.wardChat.toast,
                imageUploadFailed: 'Không thể tải ảnh lên. Vui lòng thử lại.',
                maxImageCount: 'Bạn có thể gửi tối đa {{count}} ảnh.',
                maxImageSize: 'Ảnh phải có dung lượng không quá {{size}}MB.',
                imageOnly: 'Chỉ có thể tải lên tệp ảnh.',
            },
        },
    },
    page: {
        ...generatedVi.page,
        notifications: {
            openAria: 'Mở thông báo',
            panelAria: 'Danh sách thông báo',
            title: 'Thông báo',
            unreadCount: '{{count}} thông báo chưa đọc',
            unreadShort: 'Chưa đọc {{count}}',
            justNow: 'Vừa xong',
            minutesAgo: '{{count}} phút trước',
            hoursAgo: '{{count}} giờ trước',
            loadFailed: 'Không thể tải thông báo.',
            retry: 'Thử lại',
            empty: 'Không có thông báo mới.',
        },
        profile: {
            ...generatedVi.page.profile,
            birthDate: 'Ngày sinh',
            validation: {
                ...generatedVi.page.profile.validation,
                birthDateInvalid: 'Nhập ngày từ 1900-01-01 đến hôm nay.',
            },
        },
        member: {
            ...generatedVi.page.member,
            detail: {
                ...generatedVi.page.member.detail,
                shiftRatio: 'Tỷ lệ ca hằng tháng',
                shiftRatioHelpAria: 'Hướng dẫn tỷ lệ ca hằng tháng',
                shiftRatioHint: 'Điều chỉnh số ngày mục tiêu hằng tháng cho các ca D/E/N/O có thể làm',
                shiftRatioEmpty: 'Chọn ca D/E/N/O có thể làm để đặt tỷ lệ',
                shiftRatioInputAria: 'Số ngày ca hằng tháng cho {{shiftName}}',
                shiftRatioReset: 'Mở rộng tỷ lệ ca hằng tháng',
            },
        },
        makeShift: {
            ...generatedVi.page.makeShift,
            calendar: {
                ...generatedVi.page.makeShift.calendar,
                fixCell: 'Cố định',
                unfixCell: 'Bỏ cố định',
                fixCellSuccess: 'Đã cố định ca.',
                unfixCellSuccess: 'Đã bỏ cố định ca.',
                fixedStatusPin: 'Ca cố định',
                requestStatusPin: 'Ca đã đăng ký',
            },
            context: {
                switchToast: 'Đã chuyển đến {{month}}/{{year}} · {{teamName}}.',
            },
            constraints: {
                ...generatedVi.page.makeShift.constraints,
                toast: {
                    ...generatedVi.page.makeShift.constraints.toast,
                    duplicateSkipped: 'Điều kiện này đã tồn tại.',
                    staffCountConflict: 'Số nhân sự tối thiểu, tối đa và chính xác của phạm vi và ca này đang mâu thuẫn.',
                },
                savedWarnings: {
                    title: 'Đã lưu, nhưng có một số điều kiện cần kiểm tra',
                },
                staffCountText: {
                    min: '{{dateScope}}: cần ít nhất {{count}} điều dưỡng cho ca {{shift}}.',
                    max: '{{dateScope}}: có thể phân công tối đa {{count}} điều dưỡng cho ca {{shift}}.',
                    exact: '{{dateScope}}: ca {{shift}} phải có chính xác {{count}} điều dưỡng.',
                },
                category: {
                    ...generatedVi.page.makeShift.constraints.category,
                    workRestStreaks: 'Chuỗi làm việc và nghỉ',
                    nightTransition: 'Ca đêm và chuyển ca',
                    roleCoverage: 'Kỹ năng và vai trò',
                },
                option: {
                    ...generatedVi.page.makeShift.constraints.option,
                    monthlyDayLabel: 'Ngày {{day}} hằng tháng',
                    everyday: 'Mỗi ngày',
                    weekday: 'Ngày thường',
                    weekend: 'Cuối tuần',
                    holiday: 'Ngày lễ',
                    weekendOrHoliday: 'Cuối tuần/ngày lễ',
                    weekdayName: {
                        monday: 'Thứ Hai',
                        tuesday: 'Thứ Ba',
                        wednesday: 'Thứ Tư',
                        thursday: 'Thứ Năm',
                        friday: 'Thứ Sáu',
                        saturday: 'Thứ Bảy',
                        sunday: 'Chủ Nhật',
                    },
                    target: {
                        rotating: 'Điều dưỡng xoay 3 ca',
                        nightDedicated: 'Điều dưỡng chuyên ca đêm',
                    },
                    staffCountOperator: {
                        min: 'Tối thiểu',
                        max: 'Tối đa',
                        exact: 'Chính xác',
                    },
                },
                templates: {
                    CORE_MAX_CONTINUOUS_WORK: {
                        label: 'Điều kiện cơ bản quan trọng',
                        sentence: '{target} có thể làm việc liên tiếp tối đa {count} ngày',
                    },
                    CORE_MIN_NIGHT_INTERVAL: {
                        label: 'Điều kiện cơ bản quan trọng',
                        sentence: '{target} cần cách nhau ít nhất {count} ngày giữa các ca N',
                    },
                    CORE_MAX_CONTINUOUS_NIGHT: {
                        label: 'Điều kiện cơ bản quan trọng',
                        sentence: '{target} chỉ được làm tối đa {count} ca N liên tiếp',
                    },
                    CORE_MIN_CONTINUOUS_NIGHT: {
                        label: 'Điều kiện ca đêm và chuyển ca',
                        sentence: '{target} làm ít nhất {count} ca N liên tiếp',
                    },
                    CORE_MIN_OFF_AFTER_NIGHT: {
                        label: 'Điều kiện cơ bản quan trọng',
                        sentence: '{target} cần ít nhất {count} ngày nghỉ sau ca N',
                    },
                    CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF: {
                        label: 'Điều kiện cơ bản quan trọng',
                        sentence: '{target} không được làm ca N vào ngày trước ngày nghỉ đã đăng ký',
                    },
                    STAFF_COUNT_BY_SHIFT: {
                        label: 'Điều kiện nhân sự',
                        sentence: '{dateScope}, ca {shift} phải có {operator} {count} người',
                    },
                    MIN_STAFF_BY_SHIFT: {
                        label: 'Điều kiện nhân sự',
                        sentence: 'Ca {shift} cần ít nhất {count} người',
                    },
                    MAX_STAFF_BY_SHIFT: {
                        label: 'Điều kiện nhân sự',
                        sentence: 'Ca {shift} được xếp tối đa {count} người',
                    },
                    MIN_STAFF_BY_DATE_SHIFT: {
                        label: 'Điều kiện nhân sự',
                        sentence: 'Ngày {date} hằng tháng, ca {shift} cần ít nhất {count} người',
                    },
                    MIN_STAFF_WEEKEND_HOLIDAY_SHIFT: {
                        label: 'Điều kiện nhân sự',
                        sentence: 'Cuối tuần và ngày lễ, ca {shift} cần ít nhất {count} người',
                    },
                    MAX_CONSECUTIVE_WORK_DAYS: {
                        label: 'Điều kiện làm việc-nghỉ',
                        sentence: '{target} có thể làm việc liên tiếp tối đa {count} ngày',
                    },
                    OFF_AFTER_CONSECUTIVE_WORK: {
                        label: 'Điều kiện làm việc-nghỉ',
                        sentence: '{target} cần ngày nghỉ sau {count} ngày làm việc liên tiếp',
                    },
                    MIN_OFF_AFTER_N: {
                        label: 'Điều kiện làm việc-nghỉ',
                        sentence: '{target} cần ít nhất {count} ngày nghỉ sau ca N',
                    },
                    MIN_MONTHLY_OFF: {
                        label: 'Điều kiện làm việc-nghỉ',
                        sentence: '{target} cần ít nhất {count} ngày nghỉ mỗi tháng',
                    },
                    NURSE_FORBID_WEEKEND: {
                        label: 'Điều kiện cá nhân',
                        sentence: '{nurse} không được làm việc cuối tuần hoặc ngày lễ',
                    },
                    NURSE_PREFER_SHIFT: {
                        label: 'Điều kiện cá nhân',
                        sentence: '{nurse} ưu tiên ca {shift}',
                    },
                    NURSE_AVOID_SHIFT: {
                        label: 'Điều kiện cá nhân',
                        sentence: '{nurse} muốn tránh ca {shift}',
                    },
                    MIN_OFF_AFTER_CONSECUTIVE_WORK: {
                        label: 'Điều kiện chuỗi làm việc và nghỉ',
                        sentence: '{target} nghỉ ít nhất {offCount} ngày sau khi làm liên tiếp từ {workCount} ngày',
                    },
                    AVOID_ISOLATED_WORK_DAY: {
                        label: 'Điều kiện chuỗi làm việc và nghỉ',
                        sentence: '{target} tránh chỉ làm một ngày giữa hai ngày nghỉ',
                    },
                    AVOID_ISOLATED_OFF_DAY: {
                        label: 'Điều kiện chuỗi làm việc và nghỉ',
                        sentence: '{target} tránh chỉ nghỉ một ngày giữa các ngày làm việc',
                    },
                    MAX_MONTHLY_NIGHT_COUNT: {
                        label: 'Điều kiện ca đêm và chuyển ca',
                        sentence: '{target} làm tối đa {count} ca đêm mỗi tháng',
                    },
                    NURSE_MAX_WEEKEND_HOLIDAY_SHIFTS: {
                        label: 'Giới hạn theo người',
                        sentence: '{target} làm tối đa {count} ca {shift} cuối tuần hoặc ngày lễ mỗi {period}',
                    },
                    PRECEPTEE_NOT_ALONE_SHIFT: {
                        label: 'Kỹ năng và vai trò',
                        sentence: 'Xếp thêm một điều dưỡng cùng ca khi {preceptee} làm việc',
                    },
                    PRECEPTOR_PRECEPTEE_SAME_SHIFT: {
                        label: 'Kỹ năng và vai trò',
                        sentence: 'Xếp {preceptor} và {preceptee} cùng ca',
                    },
                    IMPORTANT_MAX_WORK_STREAK: {
                        label: 'Điều kiện cơ bản quan trọng',
                        sentence: 'Làm việc liên tiếp tối đa {days} ngày',
                    },
                    IMPORTANT_MAX_SAME_DUTY_STREAK: {
                        label: 'Điều kiện cơ bản quan trọng',
                        sentence: 'Cùng một ca được làm liên tiếp tối đa {days} ngày',
                    },
                    IMPORTANT_MIN_NIGHT_INTERVAL: {
                        label: 'Điều kiện cơ bản quan trọng',
                        sentence: 'Giữa các ca N cần cách nhau ít nhất {days} ngày',
                    },
                    IMPORTANT_MAX_NIGHT_STREAK: {
                        label: 'Điều kiện cơ bản quan trọng',
                        sentence: 'Ca N liên tiếp tối đa {days} ngày',
                    },
                    IMPORTANT_OFF_AFTER_NIGHT: {
                        label: 'Điều kiện cơ bản quan trọng',
                        sentence: 'Sau ca N cần ít nhất {days} ngày OFF',
                    },
                    IMPORTANT_NO_NIGHT_BEFORE_REQUEST_OFF: {
                        label: 'Điều kiện cơ bản quan trọng',
                        sentence: 'Không được xếp ca N vào ngày trước OFF đã đăng ký',
                    },
                    IMPORTANT_FORBIDDEN_DUTY_PATTERNS: {
                        label: 'Điều kiện cơ bản quan trọng',
                        sentence: 'Tránh các mẫu ND / NE / ED / EN / NOD',
                    },
                    SOFT_MIN_STAFF_BY_DUTY: {
                        label: 'Điều kiện nhân sự',
                        sentence: 'Ca {duty} cần ít nhất {count} người',
                    },
                    SOFT_MAX_STAFF_BY_DUTY: {
                        label: 'Điều kiện nhân sự',
                        sentence: 'Ca {duty} được xếp tối đa {count} người',
                    },
                    SOFT_MIN_STAFF_BY_DATE_DUTY: {
                        label: 'Điều kiện nhân sự',
                        sentence: '{date}, ca {duty} cần ít nhất {count} người',
                    },
                    SOFT_MIN_STAFF_WEEKEND_HOLIDAY: {
                        label: 'Điều kiện nhân sự',
                        sentence: 'Cuối tuần và ngày lễ, ca {duty} cần ít nhất {count} người',
                    },
                    SOFT_NO_N_TO_D: {
                        label: 'Điều kiện cấm mẫu',
                        sentence: '{target} nên tránh ca D vào ngày sau ca N',
                    },
                    SOFT_NO_N_TO_E: {
                        label: 'Điều kiện cấm mẫu',
                        sentence: '{target} nên tránh ca E vào ngày sau ca N',
                    },
                    SOFT_NO_E_TO_D: {
                        label: 'Điều kiện cấm mẫu',
                        sentence: '{target} nên tránh ca D vào ngày sau ca E',
                    },
                    SOFT_NO_E_TO_N: {
                        label: 'Điều kiện cấm mẫu',
                        sentence: '{target} nên tránh ca N vào ngày sau ca E',
                    },
                    SOFT_MAX_CONSECUTIVE_N: {
                        label: 'Điều kiện cấm mẫu',
                        sentence: '{target} chỉ được làm tối đa {count} ca N liên tiếp',
                    },
                    SOFT_MAX_CONSECUTIVE_WORK: {
                        label: 'Điều kiện làm việc-nghỉ',
                        sentence: '{target} được làm việc liên tiếp tối đa {days} ngày',
                    },
                    SOFT_NEED_OFF_AFTER_CONSECUTIVE: {
                        label: 'Điều kiện làm việc-nghỉ',
                        sentence: '{target} cần OFF sau {days} ngày làm việc liên tiếp',
                    },
                    SOFT_NEED_OFF_AFTER_N: {
                        label: 'Điều kiện làm việc-nghỉ',
                        sentence: '{target} cần ít nhất {days} ngày OFF sau ca N',
                    },
                    SOFT_MIN_MONTHLY_OFF: {
                        label: 'Điều kiện làm việc-nghỉ',
                        sentence: '{target} cần ít nhất {days} ngày OFF mỗi tháng',
                    },
                    SOFT_NO_WEEKEND_FOR_NURSE: {
                        label: 'Điều kiện cá nhân',
                        sentence: '{nurse} không được làm việc cuối tuần hoặc ngày lễ',
                    },
                    SOFT_NO_SAME_DUTY_PAIR: {
                        label: 'Điều kiện kết hợp',
                        sentence: '{nurseA} và {nurseB} không được làm cùng ca',
                    },
                    SOFT_PREFER_SAME_DUTY_PAIR: {
                        label: 'Điều kiện kết hợp',
                        sentence: '{nurseA} nên làm cùng ca với {nurseB}',
                    },
                },
            },
        },
    },
    feature: {
        ...generatedVi.feature,
        account: {
            ...generatedVi.feature.account,
            edit: {
                ...generatedVi.feature.account.edit,
                birthDateFailed: 'Không thể lưu ngày sinh.',
            },
        },
    },
} as unknown as TLocale;
