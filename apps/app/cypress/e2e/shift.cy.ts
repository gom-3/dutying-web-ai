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

const PAGE_TIMEOUT_MS = 15000;

function dismissTutorialIfPresent() {
    cy.get('body', {timeout: PAGE_TIMEOUT_MS}).then(($body) => {
        if ($body.find('#TutorialOverlay').length === 0 && !$body.text().includes('건너뛰기')) {
            return;
        }

        cy.findByRole('button', {name: '건너뛰기', timeout: PAGE_TIMEOUT_MS}).click({force: true});
        cy.get('#TutorialOverlay', {timeout: PAGE_TIMEOUT_MS}).should('not.exist');
    });
}

function openEditableShiftScreen() {
    cy.findAllByText('근무표 작성 체험하기', {timeout: PAGE_TIMEOUT_MS}).first().click();

    cy.location('pathname', {timeout: PAGE_TIMEOUT_MS}).then((pathname) => {
        if (pathname === '/login') {
            login();
        }
    });

    cy.location('pathname', {timeout: PAGE_TIMEOUT_MS}).should('match', /^\/(make|duty|refresh)/);

    cy.get('body', {timeout: PAGE_TIMEOUT_MS}).then(($body) => {
        if ($body.text().includes('근무표 보러가기')) {
            cy.contains('button', /근무표 보러가기/, {timeout: PAGE_TIMEOUT_MS}).click();
            cy.findByRole('button', {name: '근무표 수정하기', timeout: PAGE_TIMEOUT_MS}).click();
            return;
        }

        cy.contains('button', /근무표 생성하기|다음달 근무표 만들기|이번달 근무표 만들기/, {
            timeout: PAGE_TIMEOUT_MS,
        }).click();
        dismissTutorialIfPresent();
        cy.contains('button', /^다음$/, {timeout: PAGE_TIMEOUT_MS}).click();
        cy.contains('button', /^다음$/, {timeout: PAGE_TIMEOUT_MS}).click();
        cy.contains('button', /^다음$/, {timeout: PAGE_TIMEOUT_MS}).click();
    });

    dismissTutorialIfPresent();
    cy.get('#cell_sample', {timeout: PAGE_TIMEOUT_MS}).click();
}

describe('근무 제작 페이지', () => {
    beforeEach(() => {
        cy.visit(Cypress.env('host'));
    });

    it('근무표 작성', () => {
        openEditableShiftScreen();

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
