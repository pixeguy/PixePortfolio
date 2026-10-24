# Automatic deployment to SiteGround

`.github/workflows/deploy-siteground.yml` deploys every push to `main`, including
merges into `main`. Other branches cannot deploy. Manual runs from the Actions
tab are also restricted to `main`. Deployments run one at a time.

GitHub Actions checks out the pushed commit and uploads it directly to
`/home/customer/www/jermainetai.work/public_html/` over SSH on port 18765.
The server's `~/PortfolioSitegroundSource` clone is not used by this workflow.

Before uploading, `tools/prepare-deploy.py` creates a temporary runtime copy and
adds `?v=<commit SHA>` to root CSS/JS references in HTML and local JavaScript
imports. Each release requests a matching set of scripts and styles, avoiding
old cached code when HTML has already updated. Local development files retain
their ordinary URLs. The preparation step needs only Python's standard library.

## One-time setup

Open the GitHub repository's **Settings → Secrets and variables → Actions**.
Add these as **repository secrets**, using **New repository secret**:

| Secret | Value |
| --- | --- |
| `SITEGROUND_HOST` | `gsgpm1072.siteground.biz` (verify in SiteGround SSH Credentials) |
| `SITEGROUND_USER` | The SSH username from SiteGround SSH Credentials |
| `SITEGROUND_SSH_KEY` | The complete private key text that successfully logs in, including BEGIN/END lines; not its filename |
| `SITEGROUND_SSH_PASSPHRASE` | That private key's passphrase; optional if the key has none |
| `SITEGROUND_KNOWN_HOSTS` | The trusted SSH host key line(s) obtained below |

Keep the private key and passphrase in GitHub secrets, never in repository files.
The existing working SiteGround login key can be used. A separate deployment key
authorized in SiteGround SSH Keys Manager also works.

In a **local Windows PowerShell** window (not the SiteGround SSH session), run:

```powershell
ssh-keygen -F '[gsgpm1072.siteground.biz]:18765' -f "$env:USERPROFILE\.ssh\known_hosts"
```

Copy the host key line(s) into `SITEGROUND_KNOWN_HOSTS`; omit any line starting
with `#`. This reuses the host identity saved during the successful SSH login,
instead of trusting an unverified host key fetched during each deployment.

Commit and push the workflow to `main` after adding the secrets. In GitHub,
open **Actions → Deploy main to SiteGround** and check the run. A green run
means the upload finished successfully. Refresh the live site to check its
appearance. If SiteGround's cache still serves old files, purge the site's cache.

## Files managed by deployment

Root `.html`, `.css`, `.js`, and `assets/` are deployed, excluding
`assets/sources/`. Removed runtime files are removed from the live directory by
rsync. Excluded files, including `.htaccess`, server configuration, documentation,
tools, Git metadata, and animation sources, are left alone.

Edit the local repository and push to `main` to publish. Direct File Manager edits
to managed files will be overwritten by a later deployment. Only committed,
pushed changes are deployed; local uncommitted changes are not included.

## Restore a previous version

Revert the unwanted commit on `main` and push the revert. The workflow deploys
that resulting version. The pre-deployment archive created manually in the
SiteGround SSH home folder remains separate from this workflow.
