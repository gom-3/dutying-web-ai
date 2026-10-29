// Start Vite with tests/integration/vite.conversation.config.ts, then run:
// node tests/integration/calendar-violation-layout.mjs
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer';

const origin = process.env.CALENDAR_LAYOUT_ORIGIN ?? 'http://127.0.0.1:4176';
const output = process.env.CALENDAR_LAYOUT_OUTPUT ?? '/tmp/calendar-violation-layout';
await mkdir(output, {recursive: true});
const browser = await puppeteer.launch({headless: true});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const results = [];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cases = [
    {width: 1024, days: 31},
    {width: 1280, days: 31},
    {width: 1440, days: 28},
    {width: 1920, days: 30},
    {width: 2438, days: 31},
    // Emulate a wide desktop calendar within a narrower parent/panel.
    {width: 2438, days: 31, calendarWidth: 840},
    {width: 1440, days: 31, calendarWidth: 640},
    // Request shifts must retain the familiar 26px badge when their cells have enough room.
    {width: 1920, days: 31, mode: 'request', calendarWidth: 1200, minimumBadgeSize: 25.5},
    {width: 1280, days: 31, mode: 'request', minimumBadgeSize: 21.5},
    {width: 1440, days: 28, mode: 'request', minimumBadgeSize: 21.5},
    {width: 2438, days: 31, mode: 'request', calendarWidth: 840},
    // Autofill before validation needs the same readable badge sizing as request shifts.
    {width: 1920, days: 31, faults: false, calendarWidth: 1440, minimumBadgeSize: 25.5},
    {width: 2438, days: 31, faults: false, calendarWidth: 840},
];
let popoverChecks = 0;

async function geometry() {
    return page.evaluate(() => {
        const rect = (element) => {
            const {x, y, width, height, top, right, bottom, left} = element.getBoundingClientRect();
            return {x, y, width, height, top, right, bottom, left};
        };
        const cells = [...document.querySelectorAll('.make-shift-calendar__day-cell')];
        const badges = cells.map((cell) => {
            const badge = cell.querySelector('.make-shift-calendar__shift-badge-wrap');
            const textBadge = badge.querySelector('.make-shift-calendar__shift-badge');
            const cellRect = rect(cell);
            const badgeRect = rect(badge);
            const css = getComputedStyle(cell);
            const text = document.createRange();
            text.selectNodeContents(textBadge);
            const textRect = rect(text);
            return {
                cell: cellRect,
                badge: badgeRect,
                fontSize: parseFloat(getComputedStyle(textBadge).fontSize),
                text: textRect,
                textOverflow: Math.max(
                    0,
                    badgeRect.left - textRect.left,
                    textRect.right - badgeRect.right,
                    badgeRect.top - textRect.top,
                    textRect.bottom - badgeRect.bottom,
                ),
                availableWidth: cellRect.width - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight),
            };
        });
        const violationBoxes = [...document.querySelectorAll('.make-shift-calendar__violation')].map((violation) => {
            const box = rect(violation);
            const css = getComputedStyle(violation);
            const rowBadges = [...violation.parentElement.querySelectorAll('.make-shift-calendar__shift-badge-wrap')]
                .map(rect)
                .filter((badge) => badge.right > box.left && badge.left < box.right);
            return {
                box,
                level: violation.dataset.violationLevel,
                minimumVerticalClearance: Math.min(
                    ...rowBadges.flatMap((badge) => [
                        badge.top - box.top - parseFloat(css.borderTopWidth),
                        box.bottom - parseFloat(css.borderBottomWidth) - badge.bottom,
                    ]),
                ),
            };
        });
        return {
            calendarWidth: document.querySelector('.make-shift-calendar').getBoundingClientRect().width,
            cellCount: cells.length,
            maxBadgeOverflow: Math.max(...badges.map(({availableWidth, badge}) => badge.width - availableWidth)),
            maxAspectDifference: Math.max(...badges.map(({badge}) => Math.abs(badge.width - badge.height))),
            maxTextOverflow: Math.max(...badges.map(({textOverflow}) => textOverflow)),
            minimumReadableFontRatio: badges.some(({badge}) => badge.width >= 18)
                ? Math.min(...badges.filter(({badge}) => badge.width >= 18).map(({badge, fontSize}) => fontSize / badge.width))
                : null,
            maximumFontRatio: Math.max(...badges.map(({badge, fontSize}) => fontSize / badge.width)),
            minimumBorderClearance:
                violationBoxes.length > 0 ? Math.min(...violationBoxes.map((violation) => violation.minimumVerticalClearance)) : null,
            sample: badges[0],
            violationBoxes,
            contextCount: document.querySelectorAll('[data-violation-context="true"]').length,
            pinCount: document.querySelectorAll('.make-shift-calendar__cell-status-pin').length,
        };
    });
}

try {
    for (const testCase of cases) {
        await page.setViewport({width: testCase.width, height: 1000, deviceScaleFactor: 1});
        const params = new URLSearchParams({days: String(testCase.days)});
        if (testCase.mode) params.set('mode', testCase.mode);
        if (testCase.calendarWidth) params.set('calendarWidth', String(testCase.calendarWidth));
        if (testCase.faults === false) params.set('faults', '0');
        const hasFaults = testCase.mode !== 'request' && testCase.faults !== false;
        await page.goto(`${origin}/tests/integration/calendar-violation-layout.html?${params}`, {waitUntil: 'networkidle0'});
        await page.waitForSelector('.make-shift-calendar__shift-badge-wrap');
        for (const open of [false, true]) {
            if (open) await page.click('[data-testid="toggle-sidebar"]');
            await delay(170);
            const current = await geometry();
            assert.equal(current.cellCount, testCase.days * 14);
            assert.equal(current.contextCount > 0, hasFaults, 'Context spans must follow the validation setting');
            assert.equal(current.violationBoxes.length > 0, hasFaults, 'Violation rails must follow the validation setting');
            assert(current.pinCount > 0, 'Fixed/request pins must be exercised');
            assert(
                current.maxBadgeOverflow <= 0.2,
                `Badge overflows actual available cell width: ${JSON.stringify({testCase, open, current})}`,
            );
            assert(current.maxAspectDifference <= 0.2, `Badge is not square: ${JSON.stringify({testCase, open, current})}`);
            assert(current.maxTextOverflow <= 0.5, `Shift text escapes its badge: ${JSON.stringify({testCase, open, current})}`);
            assert(current.maximumFontRatio <= 0.71, `Shift text is too large for its badge: ${JSON.stringify({testCase, open, current})}`);
            assert(
                current.minimumReadableFontRatio === null || current.minimumReadableFontRatio >= 0.48,
                `Readable badges retain undersized text: ${JSON.stringify({testCase, open, current})}`,
            );
            if (hasFaults)
                assert(
                    current.minimumBorderClearance >= 0,
                    `Badge hides top/bottom violation rail: ${JSON.stringify({testCase, open, current})}`,
                );
            if (testCase.minimumBadgeSize)
                assert(
                    current.sample.badge.width >= Math.min(testCase.minimumBadgeSize, current.sample.availableWidth) - 0.2 &&
                        current.sample.fontSize >= 11.5,
                    `Spacious calendar unnecessarily shrinks badges: ${JSON.stringify({testCase, open, current})}`,
                );
            if (!hasFaults) {
                const readableTarget = Math.min(26, Math.max(22, testCase.width * 0.0145));
                assert(
                    current.sample.badge.width >= Math.min(readableTarget, current.sample.availableWidth) - 0.2,
                    `Calendar shrinks below its readable 22–26px target without a cell-width constraint: ${JSON.stringify({testCase, open, current})}`,
                );
            }
            results.push({...testCase, open, ...current});

            if (open && hasFaults && testCase.width === 2438 && testCase.calendarWidth === 840) {
                await page.screenshot({path: `${output}/after-sidebar-open.png`, fullPage: true});
                await (await page.$('.make-shift-calendar')).screenshot({path: `${output}/after-calendar.png`});
                const baseline = await page.addStyleTag({
                    content:
                        '.make-shift-calendar__shift-badge-wrap {width:clamp(16px,1.45vw,26px)!important;height:clamp(16px,1.45vw,26px)!important;max-width:none!important;aspect-ratio:auto!important}.make-shift-calendar__shift-badge{font-size:clamp(9px,0.82vw,18px)!important}',
                });
                const before = await geometry();
                await page.screenshot({path: `${output}/before-sidebar-open.png`, fullPage: true});
                await (await page.$('.make-shift-calendar')).screenshot({path: `${output}/before-calendar.png`});
                assert(
                    before.maxBadgeOverflow > 0 && before.minimumBorderClearance < 0,
                    'Fixture must reproduce the old viewport-sized badge collision',
                );
                results.push({...testCase, open, baseline: true, ...before});
                await baseline.evaluate((element) => element.remove());
                await baseline.dispose();
            }
        }
        if (!hasFaults) continue;
        await page.click('[data-shift-nurse-id="1"] [data-day-index="6"]');
        await page.waitForSelector('[role="dialog"] [data-violation-row="true"]');
        await page.hover('[role="dialog"] [data-violation-row="true"]');
        await page.waitForSelector('.make-shift-calendar__violation[data-active-violation="true"]');
        assert.equal(await page.$$eval('[data-active-violation-shift-badge="true"]', (elements) => elements.length > 0), true);
        const dialog = await page.$eval('[role="dialog"]', (element) => ({
            left: element.getBoundingClientRect().left,
            right: element.getBoundingClientRect().right,
        }));
        assert(dialog.left >= 0 && dialog.right <= testCase.width, 'Violation popover must remain within the viewport');
        await page.keyboard.press('Escape');
        popoverChecks += 1;
    }
    assert.deepEqual(errors, []);
    await writeFile(`${output}/geometry.json`, JSON.stringify(results, null, 2));
    console.log(
        JSON.stringify(
            {
                passed: cases.length * 2,
                popoverChecks,
                output,
                results: results.map(
                    ({
                        width,
                        days,
                        mode,
                        faults,
                        calendarWidth,
                        open,
                        baseline,
                        maxBadgeOverflow,
                        maxTextOverflow,
                        minimumBorderClearance,
                        sample,
                    }) => ({
                        width,
                        days,
                        mode: mode ?? 'autofill',
                        faults: mode !== 'request' && faults !== false,
                        calendarWidth,
                        open,
                        baseline,
                        badgeWidth: sample.badge.width,
                        fontSize: sample.fontSize,
                        cellWidth: sample.cell.width,
                        maxBadgeOverflow,
                        maxTextOverflow,
                        minimumBorderClearance,
                    }),
                ),
            },
            null,
            2,
        ),
    );
} finally {
    await browser.close();
}
