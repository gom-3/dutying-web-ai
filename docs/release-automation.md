# Release Automation

`dutying-web` release automation is intentionally minimal and follows the current branch strategy:

1. Feature work lands on `develop` with one or more `.changeset/*.md` files.
2. GitHub Actions opens or updates one release PR on top of `develop`.
3. When the team is ready to cut a release, merge that release PR into `develop`.
4. Create `release/x.y.z` from the updated `develop` commit for QA.
5. After QA, merge `release/x.y.z` into `main`.
6. A second GitHub Actions workflow creates the GitHub Release and `vx.y.z` tag from the merged `main` commit.

## Workflows

### 1. Release PR (`.github/workflows/release-pr.yml`)

- Trigger: every push to `develop`
- Purpose: connect pending Changesets to a single release PR
- Action:
    - runs the custom `pnpm run release:pr` script
    - reads pending `.changeset/*.md` files on `develop`
    - creates or resets `changeset-release/develop` from the latest `develop`
    - bumps aligned workspace versions through Changesets
    - syncs the root `package.json` version
    - prepends the root `CHANGELOG.md`
    - removes consumed `.changeset/*.md` files in the release PR branch
- Result: the repository always has one reviewable "release prep" PR instead of a manual version/changelog commit flow

Why custom automation:

- `changesets/action` expects package-level `CHANGELOG.md` files when composing the release PR body.
- `dutying-web` intentionally keeps release notes only in the root `CHANGELOG.md`.
- The custom script keeps the current root-changelog policy while still opening/updating one release PR automatically.

### 1-1. Changeset Check (`.github/workflows/changeset.yml`)

- Trigger: every pull request to `develop` or `main`
- Purpose: require changesets only for release-relevant web app/package changes
- Action:
    - runs `pnpm run changeset:check`
    - compares the PR branch against `origin/<base>`
    - ignores docs, landing, CI, release automation, and version-only release PR changes
- Result: feature PRs are blocked if app/runtime changes are missing a changeset, while release PRs and automation-only PRs continue to pass

### 2. GitHub Release (`.github/workflows/github-release.yml`)

- Trigger: every push to `main`
- Purpose: convert the already-approved release commit into a GitHub Release
- Action:
    - reads the root `package.json` version
    - skips when a GitHub Release already exists for `v<version>`
    - extracts the matching root `CHANGELOG.md` section
    - creates the GitHub Release and tag

## Operator Flow

1. Add a Changeset in every feature/fix PR that should be reflected in the next release.
2. Before merging that work, run `pnpm run release:verify` locally when you need to confirm the current Changesets, planned version bump, and root changelog output in one pass.
3. `pnpm run changeset:check` should pass before the PR is merged.
4. Merge the normal work into `develop`.
5. Wait for the Release PR workflow to open or refresh the release PR.
6. Review the generated version bumps and root changelog entry.
7. Merge the release PR when you want to freeze the next release candidate.
8. Create `release/<root-version>` from that `develop` commit and run QA as usual.
9. Merge the release branch into `main`.
10. Confirm that the GitHub Release workflow created `v<root-version>`.

## Required Repository Settings

- GitHub Actions must be enabled for the repository.
- The repository-level `GITHUB_TOKEN` permission must allow write access so workflows can push the release PR branch and create releases.
- No extra npm publishing secret is required because all workspaces are still `private: true`.
- Existing Cypress secrets (`TESTING_ID`, `TESTING_PW`, `TESTING_HOST`) are unchanged and stay owned by the current test workflow.

## Failure Modes To Watch

- If a change reaches `develop` without a `.changeset/*.md`, the release PR will not include it in the next version/changelog update. `changeset.yml` should catch most of these earlier at PR time.
- If someone manually edits versions without the normal Changesets flow, the `main` release workflow can fail because the matching root `CHANGELOG.md` section is missing.
- The GitHub Release is created only after `main` receives the release commit, not when the release PR is merged into `develop`.
- `pnpm run release:verify` is a local preflight only. It validates the custom changelog helpers, prints the pending version bump, and previews the next root changelog entry, but it does not modify tracked files.
