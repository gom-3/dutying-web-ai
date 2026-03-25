function login() {
    cy.findByText('로그인').click();
    cy.findByText('카카오 계정으로 시작하기').click();

    cy.origin('https://accounts.kakao.com/login', () => {
        cy.get('#loginId--1').type(Cypress.env('id'));
        cy.get('#password--2').type(Cypress.env('pw'));
        cy.get('#mainContent > div > div > form > div.confirm_btn > button.btn_g.highlight.submit').click();
    });
}

function keyDownEvent(key: string, count: number, ctrl?: boolean, shift?: boolean) {
    Array(count)
        .fill(1)
        .forEach(() => cy.get('body').trigger('keydown', {key, ctrlKey: ctrl, shiftKey: shift}));
}

const UI_SETTLE_DELAY_MS = 300;
const TUTORIAL_TIMEOUT_MS = 10000;

function findButtonByText(doc: Document, text: string) {
    return Array.from(doc.querySelectorAll('button')).find(
        (button): button is HTMLButtonElement => button instanceof HTMLButtonElement && button.textContent?.includes(text),
    );
}

function waitForMakeTutorialToResolve(targetButtonText: string) {
    cy.document({timeout: TUTORIAL_TIMEOUT_MS}).then((doc) => {
        return new Cypress.Promise<void>((resolve, reject) => {
            if (!doc.body) {
                reject(new Error('Tutorial state could not be checked because the document body is missing.'));
                return;
            }
            let observer: MutationObserver | null = null;
            let settleTimer: number | null = null;
            let deadlineTimer: number | null = null;
            let skipRequested = false;
            const cleanup = () => {
                if (observer) observer.disconnect();
                if (settleTimer !== null) window.clearTimeout(settleTimer);
                if (deadlineTimer !== null) window.clearTimeout(deadlineTimer);
            };
            const scheduleResolve = () => {
                if (settleTimer !== null) window.clearTimeout(settleTimer);

                settleTimer = window.setTimeout(() => {
                    cleanup();
                    resolve();
                }, UI_SETTLE_DELAY_MS);
            };
            const inspect = () => {
                const targetButton = findButtonByText(doc, targetButtonText);

                if (!targetButton) {
                    return;
                }

                const overlay = doc.querySelector('#TutorialOverlay');

                if (!overlay) {
                    skipRequested = false;
                    scheduleResolve();
                    return;
                }

                const skipButton = findButtonByText(doc, '건너뛰기');

                if (!skipButton || skipRequested) {
                    return;
                }

                skipRequested = true;
                skipButton.click();
            };

            observer = new MutationObserver(inspect);
            observer.observe(doc.body, {childList: true, subtree: true, attributes: true});
            deadlineTimer = window.setTimeout(() => {
                cleanup();
                reject(new Error(`Timed out waiting for tutorial state to resolve before "${targetButtonText}".`));
            }, TUTORIAL_TIMEOUT_MS);

            inspect();
        });
    });
}

describe('근무 제작 페이지', () => {
    beforeEach(() => {
        cy.visit(Cypress.env('host'));
    });

    it('근무표 작성', () => {
        cy.findAllByText('근무표 작성 체험하기').first().click();
        waitForMakeTutorialToResolve('다음달 근무표 만들기');
        cy.findByText('다음달 근무표 만들기').click();
        cy.get('#cell_sample').click();

        {
            /**근무 입력 */
            keyDownEvent('n', 5);
            keyDownEvent('d', 3);
            keyDownEvent('e', 3);
            keyDownEvent('o', 3);
            cy.findAllByText('D').should('have.length.at.least', 4);
            cy.findAllByText('E').should('have.length.at.least', 4);
            cy.findAllByText('N').should('have.length.at.least', 4);
            cy.findAllByText('O').should('have.length.at.least', 4);
            cy.log('근무 입력 성공');
        }
        {
            /**우측 패널에 [근무자, 근무 종류]별 총 근무 횟수 표시 */
            cy.get('#count_by_nurse > div:nth-child(1)').should('include.text', 3);
            cy.get('#count_by_nurse > div:nth-child(2)').should('include.text', 3);
            cy.get('#count_by_nurse > div:nth-child(3)').should('include.text', 5);
            cy.get('#count_by_nurse > div:nth-child(4)').should('include.text', 3);
        }
        {
            /**하단 패널에 [날짜, 근무 종류]별 총 근무 횟수 표시 */
            cy.get('#count_by_day > div:nth-child(1) > div:nth-child(2) > p:nth-child(6)').should('have.text', 1);
            cy.get('#count_by_day > div:nth-child(1) > div:nth-child(2) > p:nth-child(7)').should('have.text', 1);
            cy.get('#count_by_day > div:nth-child(1) > div:nth-child(2) > p:nth-child(8)').should('have.text', 1);
            cy.get('#count_by_day > div:nth-child(2) > div:nth-child(2) > p:nth-child(9)').should('have.text', 1);
            cy.get('#count_by_day > div:nth-child(2) > div:nth-child(2) > p:nth-child(10)').should('have.text', 1);
            cy.get('#count_by_day > div:nth-child(2) > div:nth-child(2) > p:nth-child(11)').should('have.text', 1);
            cy.get('#count_by_day > div:nth-child(3) > div:nth-child(2) > p:nth-child(1)').should('have.text', 1);
            cy.get('#count_by_day > div:nth-child(3) > div:nth-child(2) > p:nth-child(2)').should('have.text', 1);
            cy.get('#count_by_day > div:nth-child(3) > div:nth-child(2) > p:nth-child(3)').should('have.text', 1);
            cy.get('#count_by_day > div:nth-child(3) > div:nth-child(2) > p:nth-child(4)').should('have.text', 1);
            cy.get('#count_by_day > div:nth-child(3) > div:nth-child(2) > p:nth-child(5)').should('have.text', 1);
            cy.get('#count_by_day > div:nth-child(4) > div:nth-child(2) > p:nth-child(12)').should('have.text', 1);
            cy.get('#count_by_day > div:nth-child(4) > div:nth-child(2) > p:nth-child(13)').should('have.text', 1);
            cy.get('#count_by_day > div:nth-child(4) > div:nth-child(2) > p:nth-child(14)').should('have.text', 1);
        }
        {
            /**잘못된 근무 표시*/
            cy.get('div.group.absolute.z-10').should('exist');
        }
        {
            /**근무 삭제 */
            keyDownEvent('Backspace', 15);
            cy.findAllByText('D').should('have.length', 2);
            cy.findAllByText('E').should('have.length', 2);
            cy.findAllByText('N').should('have.length', 2);
            cy.findAllByText('O').should('have.length', 2);
            cy.log('근무 삭제 성공');
        }
        {
            /**Undo */
            keyDownEvent('z', 14, true);
            cy.findAllByText('D').should('have.length.at.least', 4);
            cy.findAllByText('E').should('have.length.at.least', 4);
            cy.findAllByText('N').should('have.length.at.least', 4);
            cy.findAllByText('O').should('have.length.at.least', 4);
        }
        {
            /**Redo */
            keyDownEvent('z', 14, true, true);
            cy.findAllByText('D').should('have.length', 2);
            cy.findAllByText('E').should('have.length', 2);
            cy.findAllByText('N').should('have.length', 2);
            cy.findAllByText('O').should('have.length', 2);
        }
    });
});
