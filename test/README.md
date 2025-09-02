# Test Directory

This directory contains test files required by the pdf-parse npm package during the build process.

**Do not delete this directory** - it's required for successful builds.

The pdf-parse package has debug code that runs during webpack bundling and expects this test file to exist:
- `test/data/05-versions-space.pdf`

## Files:
- `05-versions-space.pdf` - Test PDF file copied from pdf-parse package