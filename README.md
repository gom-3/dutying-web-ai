<img width="1510" alt="image" src="https://github.com/gom-3/dutying-web/assets/73516336/609319d4-8560-411e-a65e-206912bc09e7">

## Introduce

This service provides an easy and convenient work schedule creation environment for head nurses who felt inconvenience due to the existing difficult work schedule creation process, and by synchronizing the created work schedules, it eliminates the hassle of registering and checking cumbersome shift work.

## Platform

We provide a web service for head nurses and a mobile app for general nurses, solving their respective issues. By linking these two platforms into a single service, we eliminate inefficient tasks that previously occurred offline.

### Web (this repo)

Our web service provides head nurses with guidance based on scheduling constraints and a work schedule auto-completion feature, reducing the time and difficulty involved in creating work schedules.

- URL : <a href="https://dutying.net">https://dutying.net</a>

### Mobile

General nurses can directly check the synchronized work schedules through the mobile app and even apply for leave. They can easily find out who they will be working with and who the shift handover will be from, without having to search through the entire Excel sheet. They can selectively sync with all calendars stored on the device, allowing them to manage all schedules through a single app.

- IOS : <a href="https://apps.apple.com/kr/app/%EB%93%80%ED%8C%85-%EA%B0%84%ED%98%B8%EC%82%AC-%EA%B7%BC%EB%AC%B4%ED%91%9C/id6466558189">App Store Link</a>
- Android : <a href="https://play.google.com/store/apps/details?id=com.gom3.dutying&hl=ko-KR">Google Play Link</a>
- Github : <a href="https://github.com/gom-3/dutying-mobile">Github Repo Link</a>

## Tech Stack

- Core : React, TypesScript, Vite
- State Management : Tanstack-Query, Zustand
- Styling : Tailwind CSS
- Package Manager : PNPM
- Test : Vitest, Jest, Cypress
- CI/CD : GitHub Actions, Vercel
- Analytics : Google Ananytics

### Vite

Despite the powerful framework that Next.js is, we chose Vite for our project because we needed to develop quickly within a set timeframe. The fast Hot Module Replacement (HMR) provided by Vite accelerated our development process. Additionally, our project primarily required developing interactive user experiences on the client-side, making Vite a more suitable choice for our needs.

## Workspace Transition

This repository now uses a `pnpm workspace` root so the current web app can move into `apps/*` and shared modules can be added under `packages/*` without changing the top-level repository layout again.

Current transition rules:

- The existing Vite web app still lives at the repository root during this stage.
- `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm test`, and `pnpm type-check` still work from the root exactly as before.
- Root scripts now delegate through `*:root` aliases so a later ticket can retarget the top-level commands to `apps/app` without changing the developer entrypoints first.
- New workspace packages should be created under `apps/*` or `packages/*`.

## Monorepo Version Policy

- The repository uses a single monorepo release version. The root `package.json` version is the canonical release number, and every workspace under `apps/*` and `packages/*` must keep the same value.
- All current workspace packages are `private: true`, so they are not publish targets yet. Even so, each workspace still keeps an explicit aligned version because release notes, release branch naming, and future Changesets fixed-version groups need one consistent version source.
- Future Changesets setup should treat the workspace packages as a fixed version group. The root package is not a publish target, but it should continue mirroring the same release number so the repository-level version stays readable in code and docs.
- If a package later becomes publishable, it joins the same shared version policy unless the release policy is intentionally changed.

### Changesets Bootstrap

- Changesets manages every workspace package under the scoped fixed group `@dutying/*`, so any accepted changeset bump applies the same release version to `apps/*` and `packages/*`.
- The root package is intentionally not part of the Changesets workspace. Run `pnpm run changeset:version` to apply workspace version bumps first and then mirror the resolved version back to the root `package.json`.
- Local release-prep flow:
    1. `pnpm run changeset:add`
    2. `pnpm run changeset:status`
    3. `pnpm run changeset:version`

## Running Tests

### Unit Tests

```bash
$ pnpm run test
```

### End-to-End Tests

Cypress is used for end-to-end testing

```bash
$ pnpm run e2e
```

### Continuous Integration

**Automatic Testing**

Upon every push and pull request to the develop branch, our GitHub Actions workflow automatically initiates a series of tests.

- <a href="https://github.com/gom-3/dutying-web/blob/develop/.github/workflows/cypress.yml">vitest.yml</a>
- <a href="https://github.com/gom-3/dutying-web/blob/develop/.github/workflows/vitest.yml">cypress.yml</a>

**Automatic Deployment**

After passing all automated tests, the changes are automatically deployed to Vercel, ensuring that our application is always up-to-date with the latest verified builds. This step not only streamlines our deployment process but also guarantees that only thoroughly tested builds are deployed to production.

![image](https://github.com/gom-3/dutying-web/assets/73516336/0e04ebcb-bc1a-45e2-b63d-723d231575b2)

## Documentaion

- <a href="https://gom3.notion.site/ce18d806df034effaf8e488f02f49cf4">Tutorial</a>
- <a href="https://gom3.notion.site/5ed51c04dd5d475c868367ed05a7d903">Terms of Use</a>

## Lisence

Apache License 2.0

<p align='center'>
  <img src='https://img.shields.io/github/package-json/v/gom-3/dutying-web'>
  <a href="https://github.com/gom-3/dutying-web/issues"><img src='https://img.shields.io/github/issues/gom-3/dutying-web'></a>
  <a href="https://github.com/gom-3/dutying-web/pulls"><img src='https://img.shields.io/github/issues-pr/gom-3/dutying-web'></a>
  <a href="https://github.com/gom-3/dutying-web/graphs/contributors"><img src='https://img.shields.io/github/contributors/gom-3/dutying-web'></a>
  <a href='https://github.com/gom-3/dutying-web/blob/main/LICENSE'><img src='https://img.shields.io/github/license/gom-3/dutying-web'></a>
</p>

## deployment

QA

- develop -> release/{{version}} -> main <-> hotfix

Complete

- main -> develop
