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
];

async function geometry() {
    return page.evaluate(() => {
        const rect = (element) => {
            const {x, y, width, height, top, right, bottom, left} = element.getBoundingClientRect();
            return {x, y, width, height, top, right, bottom, left};
        };
        const cells = [...document.querySelectorAll('.make-shift-calendar__day-cell')];
        const badges = cells.map((cell) => {
            const badge = cell.querySelector('.make-shift-calendar__shift-badge-wrap');
            const cellRect = rect(cell);
            const badgeRect = rect(badge);
            const css = getComputedStyle(cell);
            return {
                cell: cellRect,
                badge: badgeRect,
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
            minimumBorderClearance: Math.min(...violationBoxes.map((violation) => violation.minimumVerticalClearance)),
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
        await page.goto(`${origin}/tests/integration/calendar-violation-layout.html?days=${testCase.days}`, {waitUntil: 'networkidle0'});
        await page.waitForSelector('.make-shift-calendar__shift-badge-wrap');
        if (testCase.calendarWidth)
            await page.$eval(
                '.make-shift-calendar',
                (element, width) => {
                    element.style.width = `${width}px`;
                },
                testCase.calendarWidth,
            );
        for (const open of [false, true]) {
            if (open) await page.click('[data-testid="toggle-sidebar"]');
            await delay(170);
            const current = await geometry();
            assert.equal(current.cellCount, testCase.days * 14);
            assert(current.contextCount > 0, 'Context spans must be exercised');
            assert(current.pinCount > 0, 'Fixed/request pins must be exercised');
            assert(
                current.maxBadgeOverflow <= 0.2,
                `Badge overflows actual available cell width: ${JSON.stringify({testCase, open, current})}`,
            );
            assert(current.maxAspectDifference <= 0.2, `Badge is not square: ${JSON.stringify({testCase, open, current})}`);
            assert(
                current.minimumBorderClearance >= 0,
                `Badge hides top/bottom violation rail: ${JSON.stringify({testCase, open, current})}`,
            );
            results.push({...testCase, open, ...current});

            if (open && testCase.width === 2438 && testCase.calendarWidth === 840) {
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
    }
    assert.deepEqual(errors, []);
    await writeFile(`${output}/geometry.json`, JSON.stringify(results, null, 2));
    console.log(
        JSON.stringify(
            {
                passed: cases.length * 2,
                popoverChecks: cases.length,
                output,
                results: results.map(({width, days, calendarWidth, open, baseline, maxBadgeOverflow, minimumBorderClearance, sample}) => ({
                    width,
                    days,
                    calendarWidth,
                    open,
                    baseline,
                    badgeWidth: sample.badge.width,
                    cellWidth: sample.cell.width,
                    maxBadgeOverflow,
                    minimumBorderClearance,
                })),
            },
            null,
            2,
        ),
    );
} finally {
    await browser.close();
}
