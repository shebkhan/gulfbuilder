# Gulf Property Management Platform — Architecture & Guidelines (CLAUDE.md)

Project: Gulf Property Management Platform, a multi-tenant, white-label SaaS (buildings, floors, units, rooms, leases, deposits, rent, cheques, owners, financial reports).

## Key Stack & Specifications
- Next.js 15 (App Router, TypeScript strict), React 19
- Supabase: Postgres, Auth, Storage, Edge Functions, pg_cron
- Tailwind CSS, shadcn/ui, next-intl (en, ar bilingual, RTL logical utilities: ms-, me-, ps-, pe-)
- GCC Market considerations: Currency in integer minor units (QAR, AED, SAR, KWD 3 decimals, BHD 3 decimals, OMR 3 decimals), Cheque management, Owner statements, Hijri/Gregorian date support.
- Multi-tenancy with org_id and strict Postgres RLS.
