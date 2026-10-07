# Candidate Hosting Providers Comparison Report

**Student Project Hub**
**Target**: Staging & Production Deployment Evaluation

---

## 1. Candidate Providers Overview

| Provider | Free / Starter Plan Terms | Next.js 15 App Router Support | Edge Middleware Support | Commercial / Institutional Use | Recommendation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Vercel** | Hobby Plan (Non-commercial personal projects only); Pro Plan ($20/seat/mo) for institutions. | Native / First-party (Full Next 15 support) | Native Vercel Edge Network | Requires Pro plan for educational/commercial institution. | **Recommended for Staging/Prod** (Native Next.js optimizations). |
| **Cloudflare Pages** | Generous Free Plan (Unlimited requests, 100k worker requests/day). | Supported via `@cloudflare/next-on-pages` adapter. | Native Cloudflare Workers Edge | Permitted on Free & Paid tiers. | **Strong Alternative** (Lower egress cost). |
| **Netlify** | Starter Plan (100GB bandwidth, 300 build mins/mo). | Supported via `@netlify/plugin-nextjs`. | Netlify Edge Functions | Permitted on Team tiers. | Viable secondary option. |
| **AWS Amplify** | 12-month free tier; pay-as-you-go thereafter. | Supported via SSR compute. | AWS CloudFront / Lambda@Edge | Full commercial/institutional support. | Viable for campus AWS accounts. |

---

## 2. Recommendation & Staging Strategy
For rapid verification with 100% Next.js 15 feature parity (Server Actions, streaming SSR, Edge middleware), **Vercel** or **Cloudflare Pages** provide the cleanest deployment targets.
