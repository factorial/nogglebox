#!/usr/bin/env bash
# Deploy Nogglebox to AWS (S3 + CloudFront + Route 53). See DEPLOY.md.
#
#   ./deploy.sh            set up anything missing, then upload the site
#   ./deploy.sh --dry-run  show what would be created/uploaded, change nothing
#
# Safe to run every time: each setup step checks first and only creates what's missing.
# The first run takes a while (the HTTPS certificate and CloudFront both take minutes);
# after that a deploy is just the upload plus a cache flush.
set -euo pipefail
cd "$(dirname "$0")"

DRY=""
[[ "${1:-}" == "--dry-run" ]] && DRY=1

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\n\033[31m%s\033[0m\n' "$*" >&2; exit 1; }
MISSING=""
# Usage: `create "description" && command…`: runs the command, or in a dry run just reports it.
create() {
  if [[ -n "$DRY" ]]; then echo "  (dry run) would $*"; MISSING=1; return 1; fi
  echo "  creating: $*"
}
none() { [[ -z "$1" || "$1" == "None" || "$1" == "null" ]]; }

# ---------- settings ----------
if [[ ! -f deploy.env ]]; then
  cp deploy.env.example deploy.env
  fail "Created deploy.env from deploy.env.example. Check the settings in it, then run ./deploy.sh again."
fi
# shellcheck disable=SC1091
source deploy.env
: "${DOMAIN:?Set DOMAIN in deploy.env}" "${BUCKET:?Set BUCKET in deploy.env}"
REGION="${REGION:-us-east-1}"
[[ -n "${AWS_PROFILE:-}" ]] && export AWS_PROFILE || unset AWS_PROFILE
export AWS_PAGER=""

command -v aws >/dev/null || fail "The AWS CLI isn't installed. Install it: https://aws.amazon.com/cli/"
ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null) \
  || fail "Not signed in to AWS. Run 'aws configure' (or 'aws sso login'), then try again."
bold "Deploying $DOMAIN from account $ACCOUNT${DRY:+ (dry run)}"

# Fixed AWS IDs: CloudFront's DNS zone, and its managed "CachingOptimized" and
# "SecurityHeadersPolicy" policies.
CLOUDFRONT_ZONE=Z2FDTNDATAQYW2
CACHE_POLICY=658327ea-f89d-4fab-a63d-7e88639e58f6
HEADERS_POLICY=67f7725c-6f97-4210-82d7-5512b31e9d03

# ---------- 1. DNS zone (made when the domain was registered) ----------
bold "1. Route 53 hosted zone"
ZONE_ID=$(aws route53 list-hosted-zones-by-name --dns-name "$DOMAIN." \
  --query "HostedZones[?Name=='$DOMAIN.'].Id | [0]" --output text)
none "$ZONE_ID" && fail "No Route 53 hosted zone for $DOMAIN yet. If the registration is still finishing, wait and try again."
ZONE_ID=${ZONE_ID#/hostedzone/}
echo "  ok: $ZONE_ID"

# ---------- 2. S3 bucket (private) ----------
bold "2. S3 bucket"
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "  ok: $BUCKET"
elif create "the private bucket $BUCKET in $REGION"; then
  if [[ "$REGION" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
      --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
  fi
fi
if [[ -z "$DRY" ]]; then
  aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
fi

# ---------- 3. HTTPS certificate (must be in us-east-1 for CloudFront) ----------
bold "3. HTTPS certificate for $DOMAIN and www.$DOMAIN"
CERT_ARN=$(aws acm list-certificates --region us-east-1 --certificate-statuses ISSUED PENDING_VALIDATION \
  --query "CertificateSummaryList[?DomainName=='$DOMAIN'].CertificateArn | [0]" --output text)
if none "$CERT_ARN" && create "an HTTPS certificate (validated through DNS)"; then
  CERT_ARN=$(aws acm request-certificate --region us-east-1 --domain-name "$DOMAIN" \
    --subject-alternative-names "www.$DOMAIN" --validation-method DNS \
    --idempotency-token noggleboxcert --query CertificateArn --output text)
fi
if ! none "$CERT_ARN"; then
  STATUS=$(aws acm describe-certificate --region us-east-1 --certificate-arn "$CERT_ARN" \
    --query Certificate.Status --output text)
  if [[ "$STATUS" != "ISSUED" && -z "$DRY" ]]; then
    # Add the DNS records that prove we own the domain (they take a few seconds to appear).
    RECS=""
    for _ in $(seq 30); do
      RECS=$(aws acm describe-certificate --region us-east-1 --certificate-arn "$CERT_ARN" \
        --query "Certificate.DomainValidationOptions[].ResourceRecord.[Name,Value]" --output text)
      [[ -n "$RECS" && "$RECS" != *None* ]] && break
      sleep 2
    done
    CHANGES=$(echo "$RECS" | sort -u | awk '{printf "%s{\"Action\":\"UPSERT\",\"ResourceRecordSet\":{\"Name\":\"%s\",\"Type\":\"CNAME\",\"TTL\":300,\"ResourceRecords\":[{\"Value\":\"%s\"}]}}", (NR>1?",":""), $1, $2}')
    aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" \
      --change-batch "{\"Changes\":[$CHANGES]}" >/dev/null
    echo "  waiting for the certificate to be issued (usually a few minutes)…"
    aws acm wait certificate-validated --region us-east-1 --certificate-arn "$CERT_ARN"
  fi
  echo "  ok: ${STATUS:-ISSUED}"
fi

# ---------- 4. CloudFront access to the private bucket ----------
bold "4. CloudFront origin access control"
OAC_NAME="$BUCKET-oac"
OAC_ID=$(aws cloudfront list-origin-access-controls \
  --query "OriginAccessControlList.Items[?Name=='$OAC_NAME'].Id | [0]" --output text)
if none "$OAC_ID" && create "an origin access control ($OAC_NAME)"; then
  OAC_ID=$(aws cloudfront create-origin-access-control --origin-access-control-config \
    "Name=$OAC_NAME,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3" \
    --query OriginAccessControl.Id --output text)
fi
none "$OAC_ID" || echo "  ok: $OAC_ID"

# ---------- 5. CloudFront distribution ----------
bold "5. CloudFront distribution"
DIST_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Aliases.Items && contains(Aliases.Items, '$DOMAIN')].Id | [0]" --output text)
if none "$DIST_ID" && create "a CloudFront distribution for $DOMAIN and www.$DOMAIN"; then
  CONFIG=$(cat <<JSON
{
  "CallerReference": "nogglebox-$(date +%s)",
  "Comment": "Nogglebox ($DOMAIN)",
  "Enabled": true,
  "Aliases": { "Quantity": 2, "Items": ["$DOMAIN", "www.$DOMAIN"] },
  "DefaultRootObject": "index.html",
  "Origins": { "Quantity": 1, "Items": [{
    "Id": "s3-$BUCKET",
    "DomainName": "$BUCKET.s3.$REGION.amazonaws.com",
    "OriginAccessControlId": "$OAC_ID",
    "S3OriginConfig": { "OriginAccessIdentity": "" }
  }]},
  "DefaultCacheBehavior": {
    "TargetOriginId": "s3-$BUCKET",
    "ViewerProtocolPolicy": "redirect-to-https",
    "Compress": true,
    "CachePolicyId": "$CACHE_POLICY",
    "ResponseHeadersPolicyId": "$HEADERS_POLICY",
    "AllowedMethods": { "Quantity": 2, "Items": ["GET", "HEAD"],
      "CachedMethods": { "Quantity": 2, "Items": ["GET", "HEAD"] } }
  },
  "PriceClass": "PriceClass_100",
  "ViewerCertificate": {
    "ACMCertificateArn": "$CERT_ARN",
    "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021"
  },
  "HttpVersion": "http2and3",
  "IsIPV6Enabled": true
}
JSON
)
  DIST_ID=$(aws cloudfront create-distribution --distribution-config "$CONFIG" --query Distribution.Id --output text)
fi
if ! none "$DIST_ID"; then
  DIST_DOMAIN=$(aws cloudfront get-distribution --id "$DIST_ID" --query Distribution.DomainName --output text)
  echo "  ok: $DIST_ID ($DIST_DOMAIN)"
fi

# ---------- 6. Let only that distribution read the bucket ----------
bold "6. Bucket policy"
if [[ -z "$DRY" ]] && ! none "$DIST_ID"; then
  aws s3api put-bucket-policy --bucket "$BUCKET" --policy "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [{
      \"Sid\": \"AllowCloudFrontOnly\",
      \"Effect\": \"Allow\",
      \"Principal\": { \"Service\": \"cloudfront.amazonaws.com\" },
      \"Action\": \"s3:GetObject\",
      \"Resource\": \"arn:aws:s3:::$BUCKET/*\",
      \"Condition\": { \"StringEquals\": { \"AWS:SourceArn\": \"arn:aws:cloudfront::$ACCOUNT:distribution/$DIST_ID\" } }
    }]
  }"
  echo "  ok"
else
  echo "  (dry run) would set it"
fi

# ---------- 7. Point the domain at CloudFront ----------
bold "7. DNS records for $DOMAIN and www.$DOMAIN"
if [[ -z "$DRY" ]] && ! none "${DIST_DOMAIN:-}"; then
  CHANGES=""
  for name in "$DOMAIN" "www.$DOMAIN"; do
    for type in A AAAA; do
      CHANGES+="${CHANGES:+,}{\"Action\":\"UPSERT\",\"ResourceRecordSet\":{\"Name\":\"$name\",\"Type\":\"$type\",\"AliasTarget\":{\"HostedZoneId\":\"$CLOUDFRONT_ZONE\",\"DNSName\":\"$DIST_DOMAIN\",\"EvaluateTargetHealth\":false}}}"
    done
  done
  aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" \
    --change-batch "{\"Changes\":[$CHANGES]}" >/dev/null
  echo "  ok"
else
  echo "  (dry run) would point both names at CloudFront"
fi

# ---------- 8. Budget warning (optional) ----------
if [[ -n "${BUDGET_EMAIL:-}" ]]; then
  bold "8. Monthly budget warning"
  if aws budgets describe-budget --account-id "$ACCOUNT" --budget-name nogglebox-monthly >/dev/null 2>&1; then
    echo "  ok"
  elif create "a \$${BUDGET_USD:-5}/month budget that emails $BUDGET_EMAIL at 80%"; then
    aws budgets create-budget --account-id "$ACCOUNT" \
      --budget "{\"BudgetName\":\"nogglebox-monthly\",\"BudgetLimit\":{\"Amount\":\"${BUDGET_USD:-5}\",\"Unit\":\"USD\"},\"TimeUnit\":\"MONTHLY\",\"BudgetType\":\"COST\"}" \
      --notifications-with-subscribers "[{\"Notification\":{\"NotificationType\":\"ACTUAL\",\"ComparisonOperator\":\"GREATER_THAN\",\"Threshold\":80,\"ThresholdType\":\"PERCENTAGE\"},\"Subscribers\":[{\"SubscriptionType\":\"EMAIL\",\"Address\":\"$BUDGET_EMAIL\"}]}]"
  fi
fi

if [[ -n "$MISSING" ]]; then
  bold "Some setup doesn't exist yet. Run ./deploy.sh without --dry-run to create it."
  exit 0
fi

# ---------- 9. Upload the site ----------
bold "9. Upload"
# Not part of the website: docs, scripts, settings, the page template, editor/OS files.
EXCLUDES=(--exclude "*.md" --exclude "*.sh" --exclude "deploy.env*" --exclude "_template/*"
          --exclude ".git/*" --exclude ".gitignore" --exclude ".claude/*" --exclude "*.DS_Store"
          --exclude "brand/*.js" --exclude "*/audio/raw/*")
SYNC=(aws s3 sync . "s3://$BUCKET" --only-show-errors ${DRY:+--dryrun})

# Libraries and videos never change in place: browsers may keep them for a year.
"${SYNC[@]}" "${EXCLUDES[@]}" --exclude "*" --include "vendor/*" --include "*.mp4" --include "*.webm" \
  --cache-control "public, max-age=31536000, immutable"
# Everything else: browsers check for a newer copy every time. (--delete removes files that
# were deleted here; the excludes keep it away from the long-lived files above.)
"${SYNC[@]}" "${EXCLUDES[@]}" --exclude "vendor/*" --exclude "*.mp4" --exclude "*.webm" \
  --exclude "manifest.webmanifest" --cache-control "no-cache" --delete
# The app manifest needs its content type set by hand.
aws s3 cp manifest.webmanifest "s3://$BUCKET/manifest.webmanifest" --only-show-errors ${DRY:+--dryrun} \
  --content-type "application/manifest+json" --cache-control "no-cache"

# ---------- 10. Flush CloudFront's cache ----------
if [[ -n "$DRY" ]]; then
  bold "Dry run finished: nothing was changed."
  exit 0
fi
bold "10. Flushing the CloudFront cache"
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" \
  --query Invalidation.Id --output text >/dev/null
echo "  ok"
STATE=$(aws cloudfront get-distribution --id "$DIST_ID" --query Distribution.Status --output text)
if [[ "$STATE" != "Deployed" ]]; then
  echo "  waiting for CloudFront to finish setting up (the first time takes 5–15 minutes)…"
  aws cloudfront wait distribution-deployed --id "$DIST_ID"
fi

# ---------- 11. Check that the live site is really serving ----------
bold "11. Checking https://$DOMAIN"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
FAILS=0
TRIES=20   # each check retries for up to ~5 minutes (new DNS records can take a moment to spread)
ok()  { echo "  ok    $*"; }
bad() { echo "  FAIL  $*"; FAILS=$((FAILS + 1)); }

# fetch URL EXPECTED_STATUS [extra curl args…]: retries until it gets the expected status.
# Leaves the body in $TMP/body and headers in $TMP/headers. Returns 1 if it never matched.
fetch() {
  local url=$1 want=$2 code=""; shift 2
  for ((n = 1; n <= TRIES; n++)); do
    code=$(curl -sS -o "$TMP/body" -D "$TMP/headers" -w "%{http_code}" --max-time 20 "$@" "$url" 2>/dev/null) || code="no answer"
    [[ "$code" == "$want" ]] && return 0
    (( n < TRIES )) && sleep 15
  done
  echo "        (got $code from $url, expected $want)"
  return 1
}
header() { grep -i "^$1:" "$TMP/headers" | head -1; }

# The home page, on both names, and that it really is our site
if fetch "https://$DOMAIN/" 200 && grep -q "harness/harness.js" "$TMP/body"; then ok "home page loads"
else bad "home page (https://$DOMAIN/)"; TRIES=1; fi   # site unreachable: don't wait on every other check too
if header cache-control | grep -qi "no-cache"; then ok "home page is re-checked by browsers (no-cache)"
else bad "home page cache header: $(header cache-control)"; fi
if fetch "https://www.$DOMAIN/" 200 && grep -q "harness/harness.js" "$TMP/body"; then ok "www.$DOMAIN loads"
else bad "www.$DOMAIN"; fi

# Plain http should send people to https
if fetch "http://$DOMAIN/" 301 && header location | grep -qi "https://"; then ok "http:// redirects to https://"
else bad "http:// doesn't redirect to https://"; fi

# The page list, the shared helpers, and one interactive page
if fetch "https://$DOMAIN/pages.js" 200 && grep -q "window.PAGES" "$TMP/body"; then ok "page list (pages.js)"
else bad "page list (pages.js)"; fi
if fetch "https://$DOMAIN/shared/kit.js" 200; then ok "shared helpers (shared/kit.js)"
else bad "shared helpers (shared/kit.js)"; fi
PAGE=$(grep -E '^[[:space:]]*\{ id: [0-9]+' pages.js | grep -v 'video:' | head -1 | sed -E 's/.*id: ([0-9]+).*/\1/')
if [[ -n "$PAGE" ]]; then
  if fetch "https://$DOMAIN/pages/$PAGE/index.html" 200 && grep -q "shared/kit.js" "$TMP/body"; then ok "an interactive page (pages/$PAGE/)"
  else bad "interactive page $PAGE/"; fi
fi

# A video must stream in pieces (range requests; Safari won't play it otherwise), cached long-term
VIDEO=$(grep -E '^[[:space:]]*\{ id: [0-9]+' pages.js | grep 'video: "' | head -1 | sed -E 's/.*id: ([0-9]+).*video: "([^"]+)".*/\1\/\2/')
if [[ -n "$VIDEO" ]]; then
  if fetch "https://$DOMAIN/pages/$VIDEO" 206 -r 0-1023; then ok "videos stream ($VIDEO)"
  else bad "video $VIDEO doesn't stream"; fi
  if header cache-control | grep -qi "immutable"; then ok "videos are cached long-term"
  else bad "video cache header: $(header cache-control)"; fi
fi

# The app manifest needs its special content type
if fetch "https://$DOMAIN/manifest.webmanifest" 200 && header content-type | grep -qi "application/manifest+json"; then
  ok "app manifest"
else bad "app manifest content type: $(header content-type)"; fi

if (( FAILS > 0 )); then
  bold "Uploaded, but $FAILS check(s) failed (see above)."
  echo "If this was the first deploy, DNS may still be spreading: wait a few minutes and run ./deploy.sh again."
  echo "(On a Mac, 'sudo dscacheutil -flushcache' clears your computer's own DNS memory.)"
  exit 1
fi
bold "Done: https://$DOMAIN is live and all checks passed."
