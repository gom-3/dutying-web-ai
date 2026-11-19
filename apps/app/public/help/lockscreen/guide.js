(() => {
    'use strict';
    const DATA = JSON.parse(document.getElementById('tutorial-data').textContent),
        MAIN = document.getElementById('content'),
        DOCK = document.getElementById('dock');
    const KEY = 'dutying-lockscreen-tutorial-progress-v3',
        CHOICE_KEY = 'dutying-lockscreen-tutorial-choices-v3';
    const $ = (id) => document.getElementById(id);
    const escape = (value) =>
        String(value ?? '').replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[char]);
    const sourceFlows = Array.isArray(DATA.flows)
        ? DATA.flows.filter((flow) => flow && typeof flow.id === 'string' && Array.isArray(flow.steps) && flow.steps.length)
        : [];
    const wallpaperSource = sourceFlows.find((flow) => flow.id === 'wallpaper');
    const refreshSource = sourceFlows.find((flow) => flow.id === 'auto');
    // Both entry points finish with refresh setup. Reuse the same native steps
    // so shortcut URLs and iOS-specific branches stay in sync.
    const rawFlows = sourceFlows
        .filter((flow) => flow.id !== 'auto')
        .map((flow) => {
            if (flow.id === 'wallpaper') return {...flow, title: '근무표 설정'};
            if (flow.id !== 'quickadd' || !wallpaperSource || !refreshSource) return flow;
            const step = (id) => wallpaperSource.steps.find((item) => item.id === id);
            const refreshPreparation = [
                {
                    ...step('install'),
                    id: 'refresh-install',
                    phase: 'refresh',
                    title: '배경 갱신 단축어도 준비해요',
                    body: '<strong>듀팅 배경 갱신</strong>이 이미 있으면 다시 추가하지 않아도 돼요.',
                },
                {
                    ...step('target'),
                    id: 'refresh-target',
                    phase: 'refresh',
                    title: '자동 갱신할 배경을 골라요',
                    body: '<strong>듀팅 배경 갱신</strong>의 <strong>⋯</strong>를 누르세요. 파란색 <strong>배경화면</strong>을 눌러 <strong>지금 쓰고 있는 배경화면</strong>을 선택해 주세요.',
                },
                {...step('run'), id: 'refresh-run', phase: 'refresh'},
            ];
            return {
                ...flow,
                title: '할 일 버튼 설정',
                steps: [
                    {...step('ready')},
                    ...flow.steps,
                    ...refreshPreparation,
                    ...refreshSource.steps.map((item) => ({...item, phase: 'refresh'})),
                ],
            };
        });
    const legacyAutoSteps = new Map([
        ['trigger', 'auto-trigger'],
        ['condition', 'auto-condition'],
        ['shortcut', 'auto-shortcut'],
    ]);
    function canonicalRoute(flow, step) {
        return flow === 'auto' ? {flow: 'wallpaper', step: legacyAutoSteps.get(step) || step || 'refresh-method'} : {flow, step};
    }
    let decisions = {};
    try {
        const saved = JSON.parse(localStorage.getItem(CHOICE_KEY) || '{}');
        if (saved && typeof saved === 'object' && !Array.isArray(saved)) decisions = saved;
    } catch (e) {}
    const choiceDefinitions = new Map(
        rawFlows.flatMap((flow) =>
            flow.steps
                .filter((step) => step.choiceKey && Array.isArray(step.choices))
                .map((step) => [
                    step.choiceKey,
                    {values: new Set(step.choices.map((choice) => choice.value)), fallback: step.defaultChoice},
                ]),
        ),
    );
    function decision(key) {
        return choiceDefinitions.get(key)?.values.has(decisions[key]) ? decisions[key] : null;
    }
    function visibleFlows() {
        return rawFlows.map((flow) => ({
            ...flow,
            steps: flow.steps.filter(
                (step) =>
                    !step.branch || (decision(step.branch.key) || choiceDefinitions.get(step.branch.key)?.fallback) === step.branch.value,
            ),
        }));
    }
    let flows = visibleFlows();
    let current = null,
        zoomTrigger = null,
        toastTimer,
        hasRendered = false;
    function readProgress() {
        try {
            const progress = JSON.parse(localStorage.getItem(KEY) || 'null');
            return progress && typeof progress === 'object' ? {...progress, ...canonicalRoute(progress.flow, progress.step)} : null;
        } catch (e) {
            return null;
        }
    }
    function saveProgress(flow, step) {
        try {
            localStorage.setItem(KEY, JSON.stringify({flow: flow.id, step: step.id}));
        } catch (e) {}
    }
    function safeLink(value, kind) {
        if (typeof value !== 'string' || !value) return '';
        try {
            const link = new URL(value, location.href);
            if (kind === 'install') {
                return link.protocol === 'https:' &&
                    ['www.icloud.com', 'icloud.com'].includes(link.hostname) &&
                    /^\/shortcuts\/[a-zA-Z0-9]+\/?$/.test(link.pathname)
                    ? link.href
                    : '';
            }
            return ['https:', 'shortcuts:'].includes(link.protocol) ||
                (link.protocol === 'dutying:' && link.hostname === 'home' && ['', '/'].includes(link.pathname))
                ? link.href
                : '';
        } catch (e) {
            return '';
        }
    }
    function routeHash(flow, step) {
        return '#' + encodeURIComponent(flow.id) + '/' + encodeURIComponent(step.id);
    }
    function go(flow, index) {
        if (current?.step?.choices && current.flow.id === flow.id && index > current.index && !decision(current.step.choiceKey)) {
            toast('보여요 또는 안보여요를 선택해 주세요.');
            return;
        }
        if (index < 0) {
            location.hash = '';
            return;
        }
        if (index >= flow.steps.length) {
            location.hash = encodeURIComponent(flow.id) + '/done';
            return;
        }
        location.hash = routeHash(flow, flow.steps[index]);
    }
    function selectChoice(step, value) {
        if (!step.choices?.some((choice) => choice.value === value)) return;
        const flowId = current.flow.id;
        decisions[step.choiceKey] = value;
        try {
            localStorage.setItem(CHOICE_KEY, JSON.stringify(decisions));
        } catch (e) {}
        flows = visibleFlows();
        const flow = flows.find((item) => item.id === flowId),
            index = flow.steps.findIndex((item) => item.id === step.id);
        go(flow, index + 1);
    }
    function toast(text) {
        $('toast').textContent = text;
        $('toast').hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => ($('toast').hidden = true), 2600);
    }
    function icon(kind) {
        const paths = {
            calendar: '<path d="M7 2h2v3h6V2h2v3h3v16H4V5h3V2Zm-1 8v9h12v-9H6Zm2 2h3v2H8v-2Zm5 0h3v2h-3v-2Zm-5 4h3v2H8v-2Z"/>',
            add: '<path d="M10.5 4h3v6.5H20v3h-6.5V20h-3v-6.5H4v-3h6.5V4Z"/>',
            refresh: '<path d="M12 4a8 8 0 0 1 6.4 3.2V4H21v8h-8V9.4h3.8A5.4 5.4 0 1 0 17.4 14H20A8 8 0 1 1 12 4Z"/>',
            shortcut: '<path d="m12 2 10 6-10 6L2 8l10-6Zm-9 10 9 5.4 9-5.4 1 2-10 6L2 14l1-2Z"/>',
            check: '<path d="m9.5 17.5-6-6 2-2 4 4 9-9 2 2-11 11Z"/>',
            chevron: '<path d="m9 5-2 2 5 5-5 5 2 2 7-7-7-7Z"/>',
        };
        return (
            '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">' +
            (paths[kind] || paths.shortcut) +
            '</svg>'
        );
    }
    function iphoneHTML(className = 'setup-preview') {
        return (
            '<div class="' +
            className +
            '"><div class="dutying-iphone"><span class="dutying-iphone__side dutying-iphone__side--left" aria-hidden="true"></span><span class="dutying-iphone__side dutying-iphone__side--right" aria-hidden="true"></span><div class="dutying-iphone__body"><div class="dutying-iphone__screen"><img src="/help/lockscreen/assets/lockscreen-iphone.webp" width="1206" height="2622" alt="근무표와 오늘 일정이 표시된 듀팅 아이폰 잠금화면"><span class="dutying-iphone__island" aria-hidden="true"></span></div></div></div></div>'
        );
    }
    function stepIcon(flow, step) {
        if (step.choices) return 'shortcut';
        if (step.action?.href?.includes('icloud.com/shortcuts')) return 'shortcut';
        if (step.phase === 'refresh') return 'refresh';
        return flow.id === 'quickadd'
            ? 'add'
            : flow.id === 'auto' || step.id.includes('auto') || step.id.includes('notification')
              ? 'refresh'
              : 'calendar';
    }
    function acknowledgement(step, isLast) {
        if (isLast) return '설정 마치기';
        if (step.id === 'input') return '자동 갱신 연결하기';
        if (step.id === 'refresh-install') return '준비됐어요';
        const href = step.action?.href || '';
        if (href.includes('icloud.com/shortcuts')) return '추가했어요';
        if (href.startsWith('shortcuts://run')) return '실행했어요';
        if (href.startsWith('dutying:')) return '확인했어요';
        return '다음';
    }
    function preview(className = 'preview-stage') {
        return (
            '<div class="' +
            className +
            '"><img class="wallpaper-light" src="' +
            escape(DATA.previewLight || '') +
            '" alt="예시 데이터로 생성한 듀팅 월간 근무표 배경"><img class="wallpaper-dark" src="' +
            escape(DATA.previewDark || DATA.previewLight || '') +
            '" alt="예시 데이터로 생성한 어두운 듀팅 월간 근무표 배경"></div>'
        );
    }
    function cropHTML(shot, marker = true) {
        const crop = shot.crop || {x: 0, y: 0, width: shot.width, height: shot.height},
            width = Number(shot.width) || 1,
            height = Number(shot.height) || 1,
            cw = Number(crop.width) || width,
            ch = Number(crop.height) || height;
        let markerHTML = '';
        if (marker && shot.target) {
            const t = shot.target,
                tx = Math.max(3, Math.min(97, (Number(t.x) / cw) * 100)),
                ty = Math.max(3, Math.min(97, (Number(t.y) / ch) * 100));
            markerHTML = '<span class="target" aria-hidden="true" style="left:' + tx + '%;top:' + ty + '%"></span>';
        }
        return (
            '<span class="shot-crop" style="aspect-ratio:' +
            cw +
            '/' +
            ch +
            '"><img decoding="async" width="' +
            width +
            '" height="' +
            height +
            '" alt="' +
            escape(shot.alt || shot.caption || '아이폰 실제 설정 화면') +
            '" src="' +
            escape(shot.src) +
            '" style="width:' +
            (width / cw) * 100 +
            '%;left:' +
            (-Number(crop.x || 0) / cw) * 100 +
            '%;top:' +
            (-Number(crop.y || 0) / ch) * 100 +
            '%;height:' +
            (height / ch) * 100 +
            '%">' +
            markerHTML +
            '</span>'
        );
    }
    function shotHTML(key) {
        const shot = DATA.shots?.[key];
        if (!shot) return '';
        return (
            '<figure class="capture-figure"><div class="native-stage"><button class="shot-button" type="button" data-zoom="' +
            escape(key) +
            '" aria-label="' +
            escape((shot.alt || '설정 화면') + ' 크게 보기') +
            '">' +
            cropHTML(shot) +
            '</button><p class="zoom-caption">눌러서 크게 보기</p></div></figure>'
        );
    }
    function settingsHTML(settings) {
        return Array.isArray(settings) && settings.length
            ? '<dl class="step-settings">' +
                  settings.map((row) => '<div><dt>' + escape(row[0]) + '</dt><dd>' + escape(row[1]) + '</dd></div>').join('') +
                  '</dl>'
            : '';
    }
    function actionHTML(action, secondary = false) {
        if (!action) return '';
        const href = safeLink(action.href, action.kind);
        if (!href) return '';
        const isInstall = href.includes('icloud.com/shortcuts');
        const actionIcon = href.startsWith('dutying:')
            ? '<img src="/help/lockscreen/assets/dutying-logo.png" width="24" height="24" alt="">'
            : icon(isInstall ? 'add' : 'shortcut');
        return (
            '<a class="step-action' +
            (secondary ? ' secondary' : '') +
            '" href="' +
            escape(href) +
            '"' +
            (new URL(href).protocol === 'https:' ? ' target="_blank" rel="noopener"' : '') +
            '><span class="action-icon">' +
            actionIcon +
            '</span><span>' +
            escape(action.label || '단축어 열기') +
            '</span><span class="action-chevron">' +
            icon('chevron') +
            '</span></a>'
        );
    }
    function choicesHTML(step) {
        return Array.isArray(step.choices)
            ? '<div class="branch-choices" role="group" aria-label="' +
                  escape(step.title) +
                  '">' +
                  step.choices
                      .map(
                          (choice) =>
                              '<button class="branch-choice" type="button" data-choice="' +
                              escape(choice.value) +
                              '" aria-pressed="' +
                              (decision(step.choiceKey) === choice.value) +
                              '"><span>' +
                              escape(choice.label === '안보여요' ? '안 보여요' : choice.label) +
                              '</span>' +
                              icon('chevron') +
                              '</button>',
                      )
                      .join('') +
                  '</div>'
            : '';
    }
    function exampleHTML() {
        return '<section class="example" aria-labelledby="example-title"><h3 id="example-title">할 일 입력해 보기</h3><p class="example-caption">연습한 내용은 저장되지 않아요.</p><label for="demo-input">할 일</label><input id="demo-input" type="text" value="밥먹기 / 놀기" autocomplete="off" enterkeyhint="done" maxlength="300"><button class="example-save" id="demo-save" type="button">나눠보기</button><ul class="example-results" id="demo-results" aria-live="polite"></ul><p class="example-feedback" id="demo-feedback"></p></section>';
    }
    function home() {
        current = null;
        DOCK.hidden = true;
        document.body.dataset.view = 'home';
        document.title = '잠금화면 설정 · 듀팅';
        $('announcement').textContent = '';
        const progress = readProgress(),
            resumeFlow = progress && flows.find((flow) => flow.id === progress.flow),
            resumeIndex = resumeFlow ? resumeFlow.steps.findIndex((step) => step.id === progress.step) : -1;
        const tasks = [
            {id: 'wallpaper', title: '근무표 띄우기', helper: '자동 갱신 포함', icon: 'calendar'},
            {id: 'quickadd', title: '할 일 버튼 추가', helper: '자동 갱신 포함', icon: 'add'},
        ];
        const taskLinks = tasks
            .map((task, index) => {
                const flow = flows.find((item) => item.id === task.id);
                return flow
                    ? '<a class="home-task' +
                          (!index ? ' primary' : '') +
                          '" href="' +
                          escape(routeHash(flow, flow.steps[0])) +
                          '"><span class="task-icon">' +
                          icon(task.icon) +
                          '</span><span class="task-copy"><strong>' +
                          task.title +
                          '</strong>' +
                          (task.helper ? '<small>' + task.helper + '</small>' : '') +
                          '</span><span class="task-chevron">' +
                          icon('chevron') +
                          '</span></a>'
                    : '';
            })
            .join('');
        MAIN.innerHTML =
            '<section class="home"><div class="home-layout"><div class="home-content"><p class="eyebrow">아이폰 잠금화면</p><h1>무엇을<br>설정할까요?</h1><nav class="home-tasks" aria-label="설정할 기능">' +
            taskLinks +
            '</nav>' +
            (resumeIndex >= 0
                ? '<button class="resume" type="button" id="resume">이어서 설정하기<span>' +
                  escape(resumeFlow.title) +
                  ' · ' +
                  (resumeIndex + 1) +
                  '단계</span></button>'
                : '') +
            '<details class="home-help"><summary>시작 전 확인</summary><ul><li>iPhone · iOS 18 이상</li><li>듀팅 로그인과 이번 달 근무표가 필요해요.</li><li>사진 배경을 준비하고 Safari에서 진행해 주세요.</li></ul></details></div><figure class="home-preview">' +
            iphoneHTML('home-device') +
            '</figure></div></section>';
        if (resumeIndex >= 0) $('resume').addEventListener('click', () => go(resumeFlow, resumeIndex));
    }
    function topHTML(flow, index) {
        const phaseLabel = flow.steps[index]?.phase === 'refresh' ? ' · 자동 갱신' : '';
        return (
            '<div class="tutorial-top"><a class="back-menu" href="#">' +
            icon('chevron') +
            '설정 가이드</a><button class="steps-button" id="show-contents" type="button">전체 순서</button></div><div class="progress-wrap"><div class="progress-heading"><strong>' +
            escape(flow.title + phaseLabel) +
            '</strong><span>' +
            (index + 1) +
            ' / ' +
            flow.steps.length +
            '</span></div><div class="progress-track" role="progressbar" aria-label="' +
            escape(flow.title) +
            ' 진행" aria-valuemin="0" aria-valuemax="' +
            flow.steps.length +
            '" aria-valuenow="' +
            (index + 1) +
            '"><span class="progress-value" style="width:' +
            ((index + 1) / flow.steps.length) * 100 +
            '%"></span></div></div>'
        );
    }
    function stepView(flow, index) {
        const step = flow.steps[index];
        current = {flow, index, step};
        DOCK.hidden = false;
        document.body.dataset.view = 'step';
        document.title = step.title + ' · 듀팅 설정 가이드';
        saveProgress(flow, step);
        const keys = step.shots || [step.shot].filter(Boolean);
        let media = keys.map((key) => shotHTML(key)).join('');
        if (step.preview || step.id === 'ready') media = iphoneHTML() + media;
        const noMedia = !media;
        const settings = step.id === 'ready' ? null : step.settings?.filter((row) => row[1] !== step.copy);
        MAIN.innerHTML =
            '<section class="tutorial">' +
            topHTML(flow, index) +
            '<div class="step-layout' +
            (noMedia ? ' no-media' : '') +
            '"><div class="step-copy">' +
            (noMedia ? '<div class="step-symbol">' + icon(stepIcon(flow, step)) + '</div>' : '') +
            '<h1 class="step-title" id="step-title" tabindex="-1">' +
            escape(step.title) +
            '</h1>' +
            (step.body ? '<div class="step-body">' + step.body + '</div>' : '') +
            settingsHTML(settings) +
            actionHTML(step.action) +
            actionHTML(step.secondaryAction, true) +
            (step.choices ? actionHTML({label: '단축어 앱 열기', href: 'shortcuts://'}, true) : '') +
            choicesHTML(step) +
            (step.copy
                ? '<div class="copy-block"><p class="copy-label">알림 제목</p><div class="copy-row"><strong class="copy-value">' +
                  escape(step.copy) +
                  '</strong><button class="copy-button" id="copy" type="button">복사</button></div></div>'
                : '') +
            (step.note
                ? '<details class="step-help"><summary>' +
                  escape(step.noteTitle || '도움이 필요해요') +
                  '</summary><div>' +
                  step.note +
                  '</div></details>'
                : '') +
            (step.example ? '<details class="step-help"><summary>입력 연습하기</summary>' + exampleHTML() + '</details>' : '') +
            '</div>' +
            (media ? '<div class="step-media">' + media + '</div>' : '') +
            '</div></section>';
        const isChoice = !!step.choices;
        $('previous').disabled = false;
        $('previous').textContent = index ? '이전' : '처음으로';
        $('next').hidden = isChoice;
        $('next').disabled = isChoice && !decision(step.choiceKey);
        $('next').textContent = acknowledgement(step, index === flow.steps.length - 1);
        DOCK.querySelector('.dock-actions').classList.toggle('is-choice', isChoice);
        $('previous').onclick = () => go(flow, index - 1);
        $('next').onclick = () => go(flow, index + 1);
        $('show-contents').onclick = () => showContents(flow, index);
        MAIN.querySelectorAll('[data-choice]').forEach((button) =>
            button.addEventListener('click', () => selectChoice(step, button.dataset.choice)),
        );
        MAIN.querySelectorAll('[data-zoom]').forEach((button) =>
            button.addEventListener('click', () => showZoom(button.dataset.zoom, button)),
        );
        if (step.copy) $('copy').addEventListener('click', () => copyName(step.copy));
        if (step.example) {
            $('demo-save').addEventListener('click', runDemo);
            $('demo-input').addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    runDemo();
                }
            });
        }
        $('announcement').textContent = index + 1 + ' / ' + flow.steps.length + '단계. ' + step.title;
    }
    function finish(flow) {
        current = {flow, index: flow.steps.length, step: null};
        DOCK.hidden = true;
        document.body.dataset.view = 'done';
        document.title = '설정 안내 완료 · 듀팅';
        const run = flow.completionAction || {
            label: flow.id === 'quickadd' ? '할 일 입력하기' : '잠금화면 갱신하기',
            href: 'shortcuts://run-shortcut?name=' + encodeURIComponent(flow.id === 'quickadd' ? '듀팅 할 일 추가' : '듀팅 배경 갱신'),
        };
        MAIN.innerHTML =
            '<section class="tutorial">' +
            topHTML(flow, flow.steps.length - 1) +
            '<div class="done-view"><div class="done-symbol">' +
            icon('check') +
            '</div><h1 class="step-title" id="step-title" tabindex="-1">설정 안내를 마쳤어요</h1><p class="done-caption">단축어를 실행해 잠금화면을 확인해 보세요.</p>' +
            actionHTML(run) +
            '<div class="done-next"><a href="#">다른 기능 설정하기</a></div><details class="step-help"><summary>도움이 필요해요</summary><div>화면이 그대로라면 듀팅에서 이번 달 근무표를 확인하고 다시 갱신해 주세요.</div></details></div></section>';
        $('show-contents').onclick = () => showContents(flow, flow.steps.length - 1);
        $('announcement').textContent = flow.title + ' 설정 안내를 마쳤어요.';
    }
    function showContents(flow, index) {
        $('contents-title').textContent = flow.title + ' 순서';
        $('contents-list').innerHTML = flow.steps
            .map(
                (step, i) =>
                    '<li><a href="' +
                    escape(routeHash(flow, step)) +
                    '"' +
                    (index === i ? ' aria-current="step"' : '') +
                    '><span class="contents-index">' +
                    (i < index ? icon('check') : i + 1) +
                    '</span><span>' +
                    escape(step.title) +
                    '</span>' +
                    (index === i ? '<span class="contents-state">진행 중</span>' : '') +
                    '</a></li>',
            )
            .join('');
        $('contents-list')
            .querySelectorAll('a')
            .forEach((link) => link.addEventListener('click', () => $('contents').close()));
        $('contents').showModal();
    }
    function showZoom(key, trigger) {
        const shot = DATA.shots?.[key];
        if (!shot) return;
        zoomTrigger = trigger;
        $('zoom-title').textContent = current?.step?.title || '설정 화면';
        $('zoom-body').innerHTML = cropHTML(shot, false);
        $('zoom').showModal();
    }
    async function copyName(value) {
        try {
            if (!navigator.clipboard) throw new Error('clipboard unavailable');
            await navigator.clipboard.writeText(value);
            toast('복사했어요.');
        } catch (e) {
            const selection = window.getSelection(),
                node = MAIN.querySelector('.copy-value');
            if (selection && node) {
                const range = document.createRange();
                range.selectNodeContents(node);
                selection.removeAllRanges();
                selection.addRange(range);
            }
            toast('문구를 길게 눌러 복사해 주세요.');
        }
    }
    function runDemo() {
        const titles = $('demo-input')
            .value.normalize('NFC')
            .split('/')
            .map((title) => title.replace(/[\r\n\u2028\u2029]+/g, ' ').trim())
            .filter(Boolean);
        if (titles.length > 20) {
            $('demo-results').innerHTML = '';
            $('demo-feedback').textContent = '한 번에 20개까지 입력해 주세요.';
            return;
        }
        $('demo-results').innerHTML = titles.map((title) => '<li>' + escape(title) + '</li>').join('');
        $('demo-feedback').textContent = titles.length
            ? Math.min(titles.length, 20) + '개로 나뉘었어요. 실제로 저장되지는 않아요.'
            : '할 일을 하나 이상 입력해 주세요.';
    }
    function render() {
        let parts;
        try {
            parts = location.hash.slice(1).split('/').map(decodeURIComponent);
        } catch (e) {
            parts = [];
        }
        if (parts[0] === 'auto') {
            const route = canonicalRoute(parts[0], parts[1]);
            parts = [route.flow, route.step];
            history.replaceState(history.state, '', '#' + parts.map(encodeURIComponent).join('/'));
        }
        const flow = flows.find((item) => item.id === parts[0]);
        if (flow && parts[1] === 'done') finish(flow);
        else if (flow) {
            const index = flow.steps.findIndex((item) => item.id === parts[1]);
            stepView(flow, index >= 0 ? index : 0);
        } else home();
        window.scrollTo({top: 0, behavior: 'instant'});
        const heading = $('step-title');
        if (heading && hasRendered) heading.focus({preventScroll: true});
        hasRendered = true;
    }
    function updateTheme() {
        const theme = document.documentElement.dataset.theme || 'system';
        $('theme').textContent = {system: '자동', light: '밝게', dark: '어둡게'}[theme] || '자동';
        $('theme').setAttribute(
            'aria-label',
            '현재 화면 ' + ({system: '자동', light: '밝게', dark: '어둡게'}[theme] || '자동') + '. 눌러서 변경',
        );
    }
    $('theme').addEventListener('click', () => {
        const modes = ['system', 'light', 'dark'],
            old = document.documentElement.dataset.theme || 'system',
            next = modes[(modes.indexOf(old) + 1) % modes.length];
        document.documentElement.dataset.theme = next;
        try {
            localStorage.setItem('dutying-lockscreen-tutorial-theme', next);
        } catch (e) {}
        updateTheme();
    });
    document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => $(button.dataset.close).close()));
    $('zoom').addEventListener('close', () => {
        if (zoomTrigger?.isConnected) zoomTrigger.focus({preventScroll: true});
    });
    document.addEventListener('keydown', (event) => {
        if (
            !current ||
            event.defaultPrevented ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            document.querySelector('dialog[open]') ||
            event.target.closest('input,textarea,select,[contenteditable="true"]')
        )
            return;
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            go(current.flow, current.index + 1);
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            go(current.flow, current.index - 1);
        }
    });
    document.querySelector('.skip').addEventListener('click', (event) => {
        event.preventDefault();
        MAIN.focus();
        MAIN.scrollIntoView({block: 'start'});
    });
    if ('ResizeObserver' in window) {
        let reserved = -1;
        const reserveDock = new ResizeObserver(() => {
            const height = DOCK.hidden ? 0 : Math.ceil(DOCK.getBoundingClientRect().height);
            if (height !== reserved) {
                reserved = height;
                document.documentElement.style.setProperty('--dock', height + 'px');
            }
        });
        reserveDock.observe(DOCK);
    }
    window.addEventListener('hashchange', render);
    updateTheme();
    render();
})();
