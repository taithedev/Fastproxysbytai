# FastProxy by Tai (v3 beta)

A black-and-white account-based browser workspace with Supabase bookmarks, history, preferences, internal tabs, navigation controls, and optional text-only public document previews.

## Available features

- Supabase email/password sign-in, sign-up, reset request and logout.
- Account-private bookmarks, recent history and synced preferences (all new tables are prefixed fastproxy_ with RLS).
- Ten internal tabs with address bar, back/forward, refresh and home buttons.
- Website view: direct embedded iframe. The destination decides whether iframe embedding is permitted; many websites block it.
- Reader view: server-side fetch of selected public HTTPS documentation sites. This shows inert text and curated links only, not a full browsing proxy or a way around website, network or access restrictions.
- Test-mode-only Stripe Checkout architecture, authenticated Billing Portal, server-side webhook validation for subscription entitlements.
- Owner console for listing profiles and granting member or moderator roles, verified server-side. No public owner access codes.

## Deployment (Vercel)

The site can be deployed as static frontend plus Node.js API functions. Supabase URL and publishable key are in public frontend code; that is normal. NEVER put a Supabase service role key or Stripe secret in browser JS or GitHub source code.

Optional server environment variables in Vercel:
- SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (already default to the connected zuzify project)
- SUPABASE_SERVICE_ROLE_KEY (required for owner and Stripe webhook write operations; stored server-side only)
- FASTPROXY_OWNER_USER_ID (a verified Supabase Auth UUID of the owner; do not use short codes)
- FASTPROXY_SITE_URL (trusted canonical site URL used in Stripe redirects)
- STRIPE_SECRET_KEY (only sk_test_ keys are accepted; real charges intentionally disabled)
- STRIPE_WEBHOOK_SECRET (Stripe test-mode webhook secret)
- STRIPE_PRICE_PLUS, STRIPE_PRICE_PRO (test-mode recurring Price IDs)

Configure Stripe's test webhook endpoint at https://YOUR-DOMAIN/api/webhook for customer.subscription.created, customer.subscription.updated, customer.subscription.deleted. Create test-mode recurring prices in the verified, correct Stripe account. The Stripe customer portal must be enabled separately for portal sessions.

The connected Stripe integration currently exposes an unrelated-looking sandbox account, so pricing and billing credentials have not been assigned and charges have not been activated. An eligible adult account holder must set up any eventual live merchant account and handle payment verification/terms where required.

## Roles and security

- fastproxy_roles and fastproxy_subscriptions only permit users to read their own row; writes require the server secret. All added tables use fastproxy_.
- Owner role is granted by the FASTPROXY_OWNER_USER_ID server environment variable, or an authorized database administrator can insert an owner row into fastproxy_roles.
- Reader fetch is allowlisted to documentation domains in api/preview.mjs, requires HTTPS, uses redirect checks, size/time limits, escapes returned content, and never forwards user credentials/cookies.
- Never use this project to evade institutional controls or access restrictions.

## Testing

Run npm test using Node.js 20+. The workflow runs these tests on GitHub pushes and PRs. A real cross-browser and Stripe test-mode end-to-end checkout still requires deployment, correct environment variables and eligible payment setup.

## Limitations

No web application can guarantee that every third-party site works inside an iframe. Reader does not support JavaScript-heavy sites, streaming media, accounts or arbitrary websites. Subscriptions are not live, and no live pricing or payment processing is enabled.
