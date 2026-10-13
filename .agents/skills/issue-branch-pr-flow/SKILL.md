---
name: issue-branch-pr-flow
description: >-
  Mandatory workflow for implementing changes, bug fixes, or features in the repository.
  Use this skill whenever planning or executing changes to the codebase, enforcing that
  every change must follow: GitHub Issue -> Dedicated Branch -> Pull Request (direct merges
  or commits to main are strictly prohibited).
---

# Issue -> Branch -> Pull Request Workflow

All code changes, bug fixes, refactorings, and features in this repository must follow a strict Git workflow. **Direct commits and direct merges to the `main` branch are strictly prohibited.**

```
 ┌───────────────┐     ┌────────────────┐     ┌──────────────┐     ┌─────────────┐
 │ GitHub Issue  │ ──> │ Feature/Fix    │ ──> │ Verification │ ──> │ Pull Request│
 │ (#<id>)       │     │ Branch         │     │ & Changelog  │     │ (Closes #<>)│
 └───────────────┘     └────────────────┘     └──────────────┘     └─────────────┘
```

---

## The Golden Rules

1. **No Direct Commits/Pushes to `main`**: Never run `git commit` while on `main`, and never run `git push origin main`.
2. **Every Change Has an Issue**: Code changes must be linked to a tracked GitHub issue.
3. **Dedicated Working Branch**: All work happens on an issue-specific branch branched from the latest `main`.
4. **All Merges via Pull Requests**: Merging to `main` must solely occur via GitHub Pull Requests after review and CI checks.
5. **User Approval Required**: Never commit, push, or open a PR without explicit user confirmation.

---

## Step-by-Step Procedure

### 1. Verify or Create GitHub Issue

Before writing or modifying code, ensure an issue exists.

- **Check existing issues**:
  ```bash
  gh issue list --state open --limit 20
  ```
- **If an issue does not exist, create one**:
  ```bash
  gh issue create --title "<type>: <concise description>" --body "<Detailed description of problem, requirements, or acceptance criteria>"
  ```
  *(Example types: `fix`, `feat`, `refactor`, `docs`)*
- Note the issue number (`#<ISSUE_ID>`).

### 2. Branch from Clean `main`

Ensure the local `main` branch is clean and in sync with the remote repository:

```bash
git checkout main
git pull origin main
```

Create and switch to a dedicated branch following standard naming conventions:
- For bug fixes: `fix/#<ISSUE_ID>-<short-description>`
- For new features: `feat/#<ISSUE_ID>-<short-description>`
- For maintenance/refactors: `chore/#<ISSUE_ID>-<short-description>`

```bash
git checkout -b fix/#<ISSUE_ID>-<short-description>
```

### 3. Implement, Test & Document

1. **Write clean, modular code**: Respect domain boundaries, JSDoc headers, and ApplicationV2 patterns.
2. **Syntax Validation**: Run syntax checks on modified files:
   ```bash
   node -c <file_path>
   # or check all JS files:
   Get-ChildItem -Path scripts -Filter *.js -Recurse | ForEach-Object { node -c $_.FullName }
   ```
3. **Update `CHANGELOG.md`**: Add an entry under `## [Unreleased]` describing the fix or feature.
4. **Version Bump (if releasing milestone)**: Update `"version"` in [`module.json`](file:///d:/Dnd/coding/physical-dice/module.json).

### 4. Stage and Review with User

1. Inspect staged changes:
   ```bash
   git status
   git diff
   ```
2. **Request explicit user approval** before running `git commit` or `git push`.
3. Create a conventional commit referencing the issue:
   ```bash
   git add <modified-files>
   git commit -m "<type>(#<ISSUE_ID>): <imperative summary of change>"
   ```

### 5. Push Branch & Create Pull Request

1. Push the branch to the remote repository:
   ```bash
   git push -u origin <branch_name>
   ```
2. Create the Pull Request using GitHub CLI:
   ```bash
   gh pr create --base main --head <branch_name> --title "<type>: <descriptive title>" --body "Closes #<ISSUE_ID>

   ## Summary
   <Description of changes made>

   ## Verification
   - [x] Syntax checked (`node -c`)
   - [x] Tested in Foundry VTT
   - [x] Documented in CHANGELOG.md"
   ```
3. Share the PR URL with the user. Merging to `main` is handled on GitHub via PR review.
