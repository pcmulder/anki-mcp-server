# Release Process

This document outlines the process for creating a new release of the anki-mcp-server package and publishing it to npm.

## Prerequisites

1. Ensure you have npm account with publish access to the package
2. Ensure you have the NPM_TOKEN secret set up in the GitHub repository settings

## Release Steps

### 1. Update Version

Update the version in `package.json` according to [Semantic Versioning](https://semver.org/):

- **Major version (x.0.0)**: Breaking changes
- **Minor version (0.x.0)**: New features (backwards compatible)
- **Patch version (0.0.x)**: Bug fixes and minor changes

```bash
# Update version
npm version patch  # or minor, or major
```

### 2. Update Changelog

Ensure the CHANGELOG.md is updated with the new version and all changes since the last release.

### 3. Create a Pull Request

Create a pull request with the version bump and changelog updates.

### 4. Create a GitHub Release

Once the PR is merged:

1. Go to the [Releases page](https://github.com/nailuoGG/anki-mcp-server/releases)
2. Click "Draft a new release"
3. Create a new tag matching the version in package.json
   - You can use either format: `0.1.1` or `v0.1.1` (with or without the 'v' prefix)
   - The workflow will automatically handle both formats
4. Title the release with the version number
5. Add release notes (can be copied from CHANGELOG.md)
6. Click "Create release" (not "Publish release")

### 5. Monitor the Release Test Workflow

The GitHub Actions workflow will automatically:

1. Run the "Release Test" workflow first:
   - Build the package
   - Run tests on multiple Node.js versions
   - Validate the version matches the GitHub release tag
   - Check package validity

2. If all tests pass, the "Publish to NPM" workflow will run:
   - Build the package
   - Generate an SBOM (Software Bill of Materials)
   - Publish to npm with provenance

You can monitor the progress in the [Actions tab](https://github.com/nailuoGG/anki-mcp-server/actions).

### 6. Verify the Publication

Check that the package is available on npm:

```bash
npm view anki-mcp-server
```

## Troubleshooting

If the publish workflow fails:

1. Check the workflow logs in GitHub Actions
2. Common issues:
   - Version mismatch between package.json and GitHub release tag
   - Failed tests
   - npm authentication issues

## NPM Token Setup

To set up the NPM_TOKEN secret:

1. Generate an npm access token with publish permissions
2. Go to GitHub repository settings > Secrets and variables > Actions
3. Add a new repository secret named `NPM_TOKEN` with the value of your npm token
