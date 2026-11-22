# Release Automation

## Web CI/CD

`.github/workflows/vitest.yml` runs on pull requests, pushes to `develop` and
`main`, and manual dispatches. Develop and pull-request runs validate the source. Develop publishes separately
on request through the [development deployment runbook](DEV-DEPLOYMENT.md).
Production runs retain the exact tested `web-release-<commit>` artifact for
the deployment job. Pull requests do not receive Cloudflare credentials.

- `develop`: `dutying-web-ai-dev`, `https://dev.dutying.ai`, and `https://dev.api.dutying.ai`.
- `main`: `dutying-web-ai`, `https://www.dutying.ai`, and `https://api.dutying.ai`.

For `main`, set the repository Actions secret `CLOUDFLARE_API_TOKEN` to a token with Pages
deployment access to the existing Cloudflare account. Never add the value to
source, workflow logs, or chat. Without this secret, the job verifies the existing
Cloudflare Git integration instead. It succeeds only when the public domain and
unique Pages deployment URL serve the expected commit and branch for the correct
project. If no matching deployment arrives, it fails with instructions to enable
Git deployments or register the token. The account ID is public configuration.

With an upload token, the deploy job uploads the tested artifact with its source
branch and commit. Without a token, Cloudflare's existing Git integration builds
and publishes independently; this job verifies its result after CI passes.
Both modes verify `/release.json` on the unique Pages deployment URL and public
domain. A successful build alone is not a successful deployment. Direct uploads
retain GitHub build provenance; Pages action output supplies provider evidence.
Git-integrated builds retain Cloudflare metadata. Production runs are serialized. Outdated develop and pull-request validation
runs may be cancelled.

After adding or rotating the secret, re-run a failed deploy job, or dispatch
Web CI on the intended production `main` branch.

`dutying-web` release automation is intentionally minimal and follows the current branch strategy:

1. Feature work lands on `develop` with one or more `.changeset/*.md` files.
2. GitHub Actions opens or updates one release PR on top of `develop`.
3. When the team is ready to cut a release, merge that release PR into `develop`.
4. Create `release/x.y.z` from the updated `develop` commit for QA.
5. After QA, merge `release/x.y.z` into `main`.
6. A second GitHub Actions workflow creates the GitHub Release and `vx.y.z` tag from the merged `main` commit.

## Workflows

Each app build also emits `/release.json`. On Cloudflare Pages it records only the
version, provider-supplied commit/branch/deployment URL and public site origin.
The response is not cached, so a public request can identify the actually served
release when dashboard access is unavailable. It contains no runtime credentials.
Pages build metadata comes from the documented system variables:
https://developers.cloudflare.com/pages/configuration/build-configuration/

Pair this evidence with public app/browser checks; a source merge alone does not
prove that the provider published the build. CI tests the metadata boundary and
the normal production build includes the generated file.

Web CI runs on `main` and `develop` retain the verified app bundle as
`web-release-<commit>`. The bundle includes `.well-known` for existing mobile links,
the edge worker/routes and the build metadata. The branch selects the public site
origin. The production job can upload this artifact. The development runbook uses the Pages Git build.

### 1. Release PR (`.github/workflows/release-pr.yml`)

- Trigger: every push to `develop`
- Purpose: connect pending Changesets to a single release PR
- Action:
    - runs `pnpm run release:version`
    - bumps aligned workspace versions through Changesets
    - appends release notes to each changed workspace `CHANGELOG.md`
    - syncs the root `package.json` version
    - prepends the root `CHANGELOG.md`
    - removes consumed `.changeset/*.md` files in the release PR branch
- Result: the repository always has one reviewable "release prep" PR instead of a manual version/changelog commit flow

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
3. Merge the normal work into `develop`.
4. Wait for the Release PR workflow to open or refresh the release PR.
5. Review the generated version bumps and root changelog entry.
6. Merge the release PR when you want to freeze the next release candidate.
7. Create `release/<root-version>` from that `develop` commit and run QA as usual.
8. Merge the release branch into `main`.
9. Confirm that the GitHub Release workflow created `v<root-version>`.

## Required Repository Settings

- GitHub Actions must be enabled for the repository.
- The repository-level `GITHUB_TOKEN` permission must allow write access so workflows can push the release PR branch and create releases.
- No extra npm publishing secret is required because all workspaces are still `private: true`.
- Existing Cypress secrets (`TESTING_ID`, `TESTING_PW`, `TESTING_HOST`) are unchanged and stay owned by the current test workflow.

## Failure Modes To Watch

- If a change reaches `develop` without a `.changeset/*.md`, the release PR will not include it in the next version/changelog update.
- If someone manually edits versions without the normal Changesets flow, the `main` release workflow can fail because the matching root `CHANGELOG.md` section is missing.
- The GitHub Release is created only after `main` receives the release commit, not when the release PR is merged into `develop`.
- `pnpm run release:verify` is a local preflight only. It validates the custom changelog helpers, prints the pending version bump, and previews the next root changelog entry, but it does not modify tracked files.
