# 🚀 Releasing a New Version of the Neon Schema Diff Action

This document provides step-by-step instructions for maintainers to release a
new version of the Neon Schema Diff Action.

## Prerequisites

- Write access to the repository
- Git configured with appropriate credentials
- Node.js 21+ installed
- Bun package manager installed

## Release Process

### 1. Create a Release Branch

Create a new branch following the naming convention `release/X.Y.Z`:

```bash
git checkout main
git pull origin main
git checkout -b release/X.Y.Z
```

Replace `X.Y.Z` with the appropriate semantic version number (e.g.,
`release/1.2.0`).

### 2. Update Version Number

Update the `version` attribute in `package.json`:

```json
{
  "version": "X.Y.Z"
}
```

### 3. Development Setup and Verification

Follow the same steps described in the
[development documentation](./development.md):

#### Install Dependencies

```bash
bun install
```

#### Run Tests

```bash
bun run test
```

Ensure all tests pass before proceeding.

#### Verify Action Locally

```bash
cp .env.example .env
# Configure your environment variables in .env
bun run local-action
```

Test the action thoroughly to ensure it works as expected with the new version.

#### Package TypeScript for Distribution

```bash
bun run bundle
```

### 4. Create Pull Request

1. Commit your changes:

   ```bash
   git add .
   git commit -m "build: bump version to X.Y.Z"
   git push origin release/X.Y.Z
   ```

2. Create a pull request from `release/X.Y.Z` to `main` branch
3. Ensure all CI checks pass
4. Get the pull request reviewed and approved
5. Merge the pull request to `main`

### 5. Create Git Tags

After the PR is merged, create the necessary Git tags:

```bash
git checkout main
git pull origin main

# Create the specific version tag
git tag vX.Y.Z
git push origin vX.Y.Z

# Update the major version tag (e.g., v1, v2, etc.)
git tag -f vX
git push origin vX --force
```

**Note**: The major version tag (e.g., `v1`) allows users to reference the
latest version within that major release automatically.

### 6. Create GitHub Release

Follow the
[GitHub documentation for creating releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository#creating-a-release):

1. Navigate to the repository on GitHub
2. Click **Releases** on the right side of the repository page
3. Click **Draft a new release**
4. Configure the release:
   - **Choose a tag**: Select `vX.Y.Z` (the tag you just created)
   - **Release title**: `vX.Y.Z`
   - **Description**: Generate release notes
5. Click **Publish release**
