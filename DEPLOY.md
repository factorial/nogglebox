# Deploying Nogglebox (S3 + CloudFront, at nogglebox.com)

The site is plain static files with no server-side code. It's stored in a private S3 bucket and served through CloudFront, with the domain in Route 53.

## Deploying

```bash
./deploy.sh --dry-run   # see what would be created and uploaded; changes nothing
./deploy.sh             # set up anything missing, then upload the site
```

The same command does the first deploy and every one after it. Each setup step checks whether its piece already exists and only creates what's missing, so after the first run a deploy is just the upload plus a cache flush.

**Before the first run:**
1. **Domain:** the domain is registered in Route 53, and its hosted zone exists (registration creates it). The script stops with a message if the zone isn't there yet.
2. **AWS CLI login:** `aws configure` (or `aws sso login`) with a user allowed to manage S3, CloudFront, ACM, Route 53 and, optionally, Budgets. An admin user is simplest for the first run.
3. **Settings:** run `./deploy.sh` once; it creates `deploy.env` from `deploy.env.example` and stops. Check the settings (domain, bucket name, optional budget email), then run it again. `deploy.env` stays out of git.

The first run takes a while. The HTTPS certificate usually takes a few minutes to be issued, and a new CloudFront distribution takes 5–15 minutes before the site appears.

## What the script sets up
1. **Checks the Route 53 hosted zone** for the domain.
2. **Creates a private S3 bucket** with Block Public Access on. No public website hosting: only CloudFront can read it.
3. **Requests an HTTPS certificate** in ACM (us-east-1, which CloudFront requires) for the domain and `www.`, adds the DNS records that prove ownership, and waits for it to be issued.
4. **Creates an origin access control** (OAC) so CloudFront can read the private bucket.
5. **Creates the CloudFront distribution:**
   - **Names:** both the bare domain and `www.`.
   - **Default page:** `index.html`.
   - **HTTPS:** HTTP redirects to HTTPS.
   - **Caching:** the managed `CachingOptimized` policy, which follows the `Cache-Control` headers set at upload, below.
   - **Security headers:** the managed `SecurityHeadersPolicy` (HSTS, nosniff, same-origin framing, so the site can still load its own pages).
   - **Speed:** compression, HTTP/2 and 3, and IPv6.
   - **Price class 100** (North America and Europe edges), the cheapest.
6. **Sets the bucket policy** so only that distribution can read the files.
7. **Points the domain at CloudFront** with Route 53 alias records (A and AAAA) for both names.
8. **Optional budget warning:** if `BUDGET_EMAIL` is set, creates a monthly AWS Budget that emails at 80% of `BUDGET_USD` (default $5).
9. **Uploads the site**, in groups with different cache headers (below).
10. **Flushes CloudFront's cache** so changes show up right away.

## Cache headers
| Files | `Cache-Control` | Why |
|---|---|---|
| `vendor/**`, videos (`*.mp4`, `*.webm`) | `public, max-age=31536000, immutable` | Never change in place |
| Everything else (`index.html`, `pages.js`, `harness/`, `shared/`, pages) | `no-cache` | Browsers check for a newer copy every time, so changes show up right away |

Because libraries and videos are cached for a year, **a changed library or re-edited video needs a new file name**; otherwise visitors keep the old one. (`new-page.sh` always makes a new page, so this only matters when replacing a file by hand.)

`manifest.webmanifest` is uploaded separately with its correct content type. Docs, scripts, `deploy.env`, `_template/`, `.git` and editor/OS files aren't uploaded. Files deleted locally are deleted from the bucket, except libraries and videos, which have to be removed by hand.

## Cost
| Item | Cost |
|---|---|
| Domain registration | ~$15/year |
| Route 53 hosted zone | $0.50/month |
| S3 storage (the site is under 200 MB) | well under $0.01/month |
| CloudFront transfer | free up to 1 TB/month (always-free tier); that's roughly 20,000+ full video plays |
| CloudFront cache flushes | free (first 1,000 paths/month; each deploy uses 1) |

About $0.50/month plus the domain, at family scale.

## Local server vs. production
`serve.sh` is for development only and imitates what S3 + CloudFront already do:
- **Range requests** (needed to play video in Safari): S3 and CloudFront support these natively.
- **`Cache-Control: no-store`**: dev only, so edits show up immediately. Production uses the cache headers above.
- **Content types**: `aws s3 sync` sets these from file extensions. `manifest.webmanifest` is the one exception, handled by the script.

## Later: offline mode
A service worker could cache the site on the tablet after the first visit. It requires HTTPS, which this setup provides. Videos should be cached one at a time after they're watched, not all up front, to save tablet storage.
