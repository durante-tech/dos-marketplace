/**
 * Billing / Subscriptions archetype — 2nd archetype in the corpus, the
 * generalization proof (Stage 0 of Plans/Roadmaps/archetypes-roadmap-2026-07.md).
 * Grounded in two live-doc cohorts fetched 2026-07-08 (in-app SaaS billing +
 * dedicated billing platforms). Synthesized by a fan-out team, reconciled
 * against an adversarial silent-absence skeptic (verdict ADJUST — all fixes
 * applied: 3 services-6/6 rows re-tiered to T1, 2 webhook rows re-grounded,
 * 3 silently-absent rows added, 3 anti-criteria added).
 */
import type { Archetype } from '../Schema/Archetype';

export const Billing: Archetype = {
  "name": "billing",
  "title": "Billing / Subscriptions",
  "version": "0.5.0",
  "updated": "2026-07-09",
  "cohorts": [
    {
      "id": "inapp",
      "label": "In-app SaaS billing (product-embedded; sets user expectations)",
      "references": [
        "Vercel",
        "Linear",
        "Notion",
        "GitHub",
        "Slack",
        "Figma",
        "Loom",
        "Intercom"
      ]
    },
    {
      "id": "services",
      "label": "Dedicated billing/subscription platforms (API-tier norms; universal here forces T1)",
      "references": [
        "Stripe Billing",
        "Paddle",
        "Lemon Squeezy",
        "Chargebee",
        "Orb",
        "Recurly"
      ]
    }
  ],
  "tierDefinitions": {
    "T1": "Table-stakes: essentially all in-app references ship it (>=6/8), OR it is universal across the billing-services cohort — that override is unconditional and applies even when in-app coverage is low (in-app UIs hide backend capabilities; demoting a universal capability requires a groundingException). Absence reads as broken/unfinished. MUST be built or deferred-with-ledger-row; silent absence is the failure.",
    "T2": "Expected: majority of in-app references (4-5/8). Absence is a known limitation admins ask about within weeks. Deferral needs a one-line reason.",
    "T3": "Delighter: rare or absent among market references (<=3/8 in-app, including 0 and rows with no in-app evidence at all, unless the universality override applies). Optional; building one while T1 rows are silent-absent is the anti-pattern. (A declared groundingException in the row data — never inferred by a reviewer — is the only other path to T1.)"
  },
  "rows": [
    {
      "id": "tiered-plan-catalog",
      "capability": "Tiered plan catalog (free + paid tiers + enterprise)",
      "dimension": "Plans/Pricing",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 8,
          "of": 8
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "note": "flat-rate recurring pricing is the services plan primitive"
        }
      ],
      "seedISC": "Offer a free tier plus stepped paid plans selectable in-app"
    },
    {
      "id": "per-seat-pricing",
      "capability": "Per-seat / per-user pricing",
      "dimension": "Plans/Pricing",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 7,
          "of": 8
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6
        }
      ],
      "seedISC": "Bill per active seat, recalculated as members join or leave",
      "notes": "Role-differentiated seat pricing (editor/dev/viewer) with admin reassignment in 3/8 in-app is a premium variant."
    },
    {
      "id": "billing-cadence-toggle",
      "capability": "Monthly vs annual billing-cadence toggle",
      "dimension": "Plans/Pricing",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 8,
          "of": 8
        }
      ],
      "seedISC": "Let admins switch between monthly and annual billing cadence"
    },
    {
      "id": "annual-commitment-discount",
      "capability": "Annual-commitment discount",
      "dimension": "Plans/Pricing",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 6,
          "of": 8
        }
      ],
      "seedISC": "Price the annual plan below the monthly-equivalent to reward prepayment",
      "notes": "Grounded on in-app 6/8 (=0.75 T1 floor); a prepay-cadence discount is distinct from a redeemable promo code."
    },
    {
      "id": "plan-comparison-view",
      "capability": "In-app plan comparison / included-features view",
      "dimension": "Plans/Pricing",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 6,
          "of": 8
        },
        {
          "cohort": "services",
          "shipping": 2,
          "of": 6,
          "note": "no-code pricing table"
        }
      ],
      "seedISC": "Show what each plan includes so users self-select the right tier"
    },
    {
      "id": "coupons-promo-codes",
      "capability": "Coupons / discounts / redeemable promo codes",
      "dimension": "Plans/Pricing",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6
        }
      ],
      "seedISC": "Apply percentage or fixed discounts through redeemable promo codes",
      "notes": "Universal in services (6/6); in-app surfaces discounting mainly as the annual toggle, so tiered by in-app expectation."
    },
    {
      "id": "multi-currency",
      "capability": "Multi-currency pricing and presentment",
      "dimension": "Plans/Pricing",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6
        }
      ],
      "seedISC": "Present and settle prices in the buyer's local currency",
      "notes": "6/6 in services; the in-app cohort did not surface a self-serve currency control."
    },
    {
      "id": "usage-based-pricing",
      "capability": "Usage-based / metered pricing model",
      "dimension": "Plans/Pricing",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 3,
          "of": 8
        },
        {
          "cohort": "services",
          "shipping": 5,
          "of": 6
        }
      ],
      "contextRider": "metered",
      "seedISC": "Meter consumption and bill overage beyond an included allowance",
      "notes": "Near-universal in services (5/6), in-app only on consumption-priced products. Graduated/volume tier math in 4/6 services; prepaid credit-grant consumption in 3/6."
    },
    {
      "id": "addon-credit-packs",
      "capability": "Add-ons / a la carte credit packs",
      "dimension": "Plans/Pricing",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 3,
          "of": 8
        },
        {
          "cohort": "services",
          "shipping": 5,
          "of": 6
        }
      ],
      "seedISC": "Sell optional add-ons or credit packs alongside the base plan"
    },
    {
      "id": "self-serve-upgrade-immediate",
      "capability": "Self-serve upgrade with immediate access + charge",
      "dimension": "Checkout",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 8,
          "of": 8
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "note": "upgrade/downgrade plan changes"
        }
      ],
      "seedISC": "Upgrade instantly in-app with immediate feature access and charge"
    },
    {
      "id": "inline-card-capture",
      "capability": "Inline card capture at checkout",
      "dimension": "Checkout",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 8,
          "of": 8
        },
        {
          "cohort": "services",
          "shipping": 5,
          "of": 6,
          "note": "embeddable/overlay checkout"
        }
      ],
      "seedISC": "Collect the payment method inline during upgrade, without a redirect",
      "notes": "Provider-hosted checkout page / payment link is the alternative shape in 5/6 services."
    },
    {
      "id": "free-trial-autoconvert",
      "capability": "Free trial (time-boxed, auto-converts)",
      "dimension": "Checkout",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 4,
          "of": 8
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6
        }
      ],
      "seedISC": "Grant a time-boxed trial that converts to paid unless cancelled"
    },
    {
      "id": "plan-change-up-down",
      "capability": "Self-serve upgrade AND downgrade",
      "dimension": "Subscription-Lifecycle",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 8,
          "of": 8
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6
        }
      ],
      "seedISC": "Allow plan changes in both directions without contacting support"
    },
    {
      "id": "automatic-proration",
      "capability": "Automatic proration on mid-cycle changes",
      "dimension": "Subscription-Lifecycle",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 6,
          "of": 8
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6
        }
      ],
      "seedISC": "Prorate charges automatically when plan or seat count changes mid-cycle"
    },
    {
      "id": "self-serve-cancel-period-end",
      "capability": "Self-serve cancellation, access to period end",
      "dimension": "Subscription-Lifecycle",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 6,
          "of": 8
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "note": "cancel immediately or at period end"
        }
      ],
      "seedISC": "Let admins cancel in-app while keeping access until period end",
      "notes": "Auto-renewal with an admin disable toggle in 2/8 in-app."
    },
    {
      "id": "deferred-downgrade",
      "capability": "Downgrade deferred to end of current period",
      "dimension": "Subscription-Lifecycle",
      "tier": "T2",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 5,
          "of": 8
        },
        {
          "cohort": "services",
          "shipping": 5,
          "of": 6,
          "note": "scheduled/future-dated changes"
        }
      ],
      "seedISC": "Defer downgrades to period end so already-paid time is not lost"
    },
    {
      "id": "seat-add-remove-midcycle",
      "capability": "Self-serve seat add/remove mid-cycle",
      "dimension": "Subscription-Lifecycle",
      "tier": "T1",
      "notes": "archer gen-1 re-tier T2→T1: services-universal 6/6 (uniform OR-clause) — the one row the billing skeptic missed; caught by the gen-1 blast-radius scan",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 5,
          "of": 8
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "note": "per-seat quantity sync"
        }
      ],
      "seedISC": "Adjust seat count anytime with automatic billing reconciliation"
    },
    {
      "id": "prorated-credit-removed-seats",
      "capability": "Prorated credit for removed/suspended seats",
      "dimension": "Subscription-Lifecycle",
      "tier": "T2",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 4,
          "of": 8
        }
      ],
      "seedISC": "Credit unused time automatically and apply it to future invoices",
      "notes": "Auto-applied credit for removed/suspended seats is a universal in-app surprise (Figma, Intercom, Linear, Slack)."
    },
    {
      "id": "pause-resume-subscription",
      "capability": "Pause / resume subscription",
      "dimension": "Subscription-Lifecycle",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 5,
          "of": 6
        }
      ],
      "seedISC": "Pause billing and later resume without a fresh signup",
      "notes": "Near-universal in services (5/6) but the in-app cohort ships no pause, so tiered by in-app expectation."
    },
    {
      "id": "view-download-invoices",
      "capability": "View + download invoices in-app",
      "dimension": "Invoicing",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 8,
          "of": 8
        },
        {
          "cohort": "services",
          "shipping": 5,
          "of": 6,
          "note": "hosted portal"
        }
      ],
      "seedISC": "Expose every invoice for self-serve viewing and download in settings",
      "notes": "Upcoming-invoice / next-charge estimate in 3/8 in-app."
    },
    {
      "id": "recurring-invoice-generation",
      "capability": "Automated recurring invoice generation",
      "dimension": "Invoicing",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6
        }
      ],
      "seedISC": "Generate and finalize a recurring invoice automatically each billing cycle",
      "notes": "In-app invoice generation is inferred from universal viewability; grounded on services 6/6 to avoid a fabricated count."
    },
    {
      "id": "pdf-invoice-receipt",
      "capability": "PDF invoice / receipt generation",
      "dimension": "Invoicing",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 6,
          "of": 8
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "note": "branded PDF from templates"
        }
      ],
      "seedISC": "Generate a downloadable PDF invoice or receipt for each charge"
    },
    {
      "id": "billing-history-archive",
      "capability": "Billing history / past statements archive",
      "dimension": "Invoicing",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 6,
          "of": 8
        }
      ],
      "seedISC": "Keep a browsable archive of past charges and statements by date",
      "notes": "Editable invoice header (company name/address) in 4/8 in-app."
    },
    {
      "id": "credit-notes-immutable-invoices",
      "capability": "Immutable issued invoices; corrections via credit notes",
      "dimension": "Invoicing",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 2,
          "of": 8,
          "note": "immutable issued invoices"
        },
        {
          "cohort": "services",
          "shipping": 4,
          "of": 6,
          "note": "credit notes"
        }
      ],
      "seedISC": "Correct invoices through credit notes, never by editing issued invoices"
    },
    {
      "id": "card-acceptance",
      "capability": "Credit / debit card acceptance",
      "dimension": "Payment-Methods",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 8,
          "of": 8
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6
        }
      ],
      "seedISC": "Accept major credit and debit cards as the default payment method"
    },
    {
      "id": "self-serve-update-payment",
      "capability": "Self-serve update of payment method",
      "dimension": "Payment-Methods",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 6,
          "of": 8
        },
        {
          "cohort": "services",
          "shipping": 5,
          "of": 6,
          "note": "hosted portal"
        }
      ],
      "seedISC": "Let admins replace the card on file without contacting support"
    },
    {
      "id": "digital-wallets",
      "capability": "Digital wallets (Apple Pay / Google Pay)",
      "dimension": "Payment-Methods",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 5,
          "of": 6
        }
      ],
      "seedISC": "Accept Apple Pay and Google Pay wallet payments at checkout",
      "notes": "5/6 in services; the in-app cohort did not surface wallet support explicitly."
    },
    {
      "id": "alternative-payment-methods",
      "capability": "ACH / direct-debit and pay-by-invoice / PO",
      "dimension": "Payment-Methods",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 3,
          "of": 8,
          "note": "pay-by-invoice/PO, size-gated"
        },
        {
          "cohort": "services",
          "shipping": 4,
          "of": 6,
          "note": "manual/one-off invoicing; ACH/SEPA/BACS direct-debit in 3/6"
        }
      ],
      "seedISC": "Offer ACH, direct-debit, or invoice/PO billing gated by account size"
    },
    {
      "mandatedBy": "a-failed-payment-keeps-access",
      "id": "dunning-retry-pastdue",
      "capability": "Failed-payment retry + past-due state (dunning)",
      "dimension": "Dunning",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 2,
          "of": 8
        },
        {
          "cohort": "services",
          "shipping": 5,
          "of": 6,
          "note": "the default retry/dunning path, not a premium add-on"
        }
      ],
      "seedISC": "Retry failed payments and gate access through a past-due state",
      "notes": "Mandated by anti a-failed-payment-keeps-access — a past-due gate is table-stakes for provider-abstracted billing, not a differentiator."
    },
    {
      "id": "tax-id-collection",
      "capability": "VAT / Tax ID collection on invoices",
      "dimension": "Tax/Compliance",
      "tier": "T2",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 5,
          "of": 8,
          "note": "VAT/Tax ID self-entry"
        },
        {
          "cohort": "services",
          "shipping": 5,
          "of": 6,
          "note": "collection + validation, reverse charge"
        }
      ],
      "seedISC": "Collect and validate a VAT or tax ID, applying B2B reverse charge"
    },
    {
      "id": "automatic-tax-calculation",
      "capability": "Automatic sales-tax / VAT calculation by region",
      "dimension": "Tax/Compliance",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 3,
          "of": 8
        },
        {
          "cohort": "services",
          "shipping": 5,
          "of": 6
        }
      ],
      "seedISC": "Compute sales tax or VAT by jurisdiction at invoice time",
      "notes": "SERVICES CEILING: near-universal via Stripe Tax (5/6); requires a billing address (captured 4/8 in-app); a provider-abstracted kit gets it near-free. Tax filing & remittance on your behalf is the premium ceiling (3/6 services)."
    },
    {
      "id": "revenue-recognition",
      "capability": "Revenue recognition / deferred-revenue reporting (ASC 606)",
      "dimension": "Tax/Compliance",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 4,
          "of": 6
        }
      ],
      "seedISC": "Report recognized and deferred revenue per ASC 606 with exports",
      "notes": "Finance/enterprise ceiling; the in-app cohort never surfaces rev-rec."
    },
    {
      "id": "merchant-of-record",
      "capability": "Merchant of Record (seller-of-record + tax liability)",
      "dimension": "Tax/Compliance",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 2,
          "of": 6,
          "note": "Paddle, Lemon Squeezy"
        }
      ],
      "seedISC": "Let the provider act as merchant of record, assuming tax liability",
      "notes": "MoR assumes global sales-tax collection and liability, not just calculation, the premium differentiator."
    },
    {
      "id": "usage-metering-aggregation",
      "capability": "Usage event ingestion + aggregation",
      "dimension": "Usage/Metering",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 4,
          "of": 6,
          "note": "metering API + sum/count/max/unique aggregation"
        }
      ],
      "contextRider": "usage-based",
      "seedISC": "Ingest usage events and aggregate by sum, count, max, or unique",
      "notes": "Orb adds custom-SQL metrics, backdated re-rating, and pricing simulation against historical usage, the metering-specialist moat."
    },
    {
      "id": "live-usage-and-alerts",
      "capability": "Live usage dashboard + threshold alerts",
      "dimension": "Usage/Metering",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 3,
          "of": 8
        },
        {
          "cohort": "services",
          "shipping": 2,
          "of": 6
        }
      ],
      "contextRider": "metered",
      "seedISC": "Show real-time metered consumption against limits with threshold alerts",
      "notes": "Budgets/spend caps that hard-stop metered usage in 3/8 in-app; per-project usage breakdown in 2/8."
    },
    {
      "id": "billing-settings-hub",
      "capability": "Unified self-serve billing settings hub",
      "dimension": "Customer-Portal",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 8,
          "of": 8
        },
        {
          "cohort": "services",
          "shipping": 5,
          "of": 6,
          "note": "hosted self-service portal"
        }
      ],
      "seedISC": "Give admins one settings hub for plan, payment, invoices, usage",
      "notes": "No-code portal branding/configuration in 3/6 services."
    },
    {
      "id": "idempotent-webhooks",
      "capability": "Idempotent billing-webhook processing",
      "dimension": "Reliability",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "note": "lifecycle webhooks universal across providers"
        }
      ],
      "seedISC": "Process each billing webhook exactly once, deduped by event id",
      "notes": "Services emit lifecycle webhooks 6/6; the kit must consume them idempotently, claim-first commit so a retried event never double-charges."
    },
    {
      "id": "webhook-gated-entitlements",
      "capability": "Webhook-confirmed entitlement grants",
      "dimension": "Reliability",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "note": "consumer-side twin of universal webhook emission"
        }
      ],
      "seedISC": "Grant or revoke access only after webhook confirmation, never optimistically"
    },
    {
      "id": "org-scoped-billing",
      "riderRationale": "billing attaches to the org, not the user, in multitenant SaaS — foundational (basis derived gen-18 from row semantics; mint-time record predates the field — re-derive at next re-mine)",
      "capability": "Org/tenant-scoped billing records",
      "dimension": "Multitenancy",
      "tier": "T1",
      "evidence": [],
      "contextRider": "saas-multitenant",
      "seedISC": "Scope every subscription, invoice, and usage record to its org"
    },
    {
      "id": "seat-entitlement-sync",
      "riderRationale": "plan entitlements must gate per-org feature access — the point of seats (basis derived gen-18 from row semantics; mint-time record predates the field — re-derive at next re-mine)",
      "capability": "Seat count synced to org membership",
      "dimension": "Multitenancy",
      "tier": "T1",
      "evidence": [],
      "contextRider": "saas-multitenant",
      "seedISC": "Keep billed seat count in sync with org membership",
      "notes": "Feature-access entitlements gated by the active plan, a formal entitlements API in 2/6 services."
    },
    {
      "id": "billing-admin-role",
      "capability": "Billing-admin role gate",
      "dimension": "Admin/Governance",
      "tier": "T2",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 5,
          "of": 8
        }
      ],
      "seedISC": "Restrict billing management to owners or a dedicated billing-admin role",
      "notes": "View-only billing contacts as a distinct role in 4/8 in-app; cost-centers / chargeback grouping in 1/8 (enterprise)."
    },
    {
      "id": "subscription-analytics",
      "capability": "Native subscription analytics (MRR, churn, ARPU, LTV)",
      "dimension": "Admin/Governance",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 5,
          "of": 6
        }
      ],
      "seedISC": "Surface MRR, churn, ARPU, and LTV dashboards for operators",
      "notes": "Stripe requires Sigma/Data Pipeline for equivalents; custom report builder + warehouse exports in 4/6 services."
    },
    {
      "id": "payment-error-states",
      "capability": "Mapped payment error states (declined / 3DS)",
      "dimension": "States",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 2,
          "of": 8,
          "note": "documented; universal in practice"
        }
      ],
      "groundingException": "Universal in practice (card-declined UI, past-due banners, retry prompts) but doc-thin; every billing surface renders a payment-failure state.",
      "seedISC": "Failed payments show mapped, actionable messages, never raw gateway codes"
    },
    {
      "id": "test-sandbox-billing-path",
      "capability": "Test / sandbox billing environment",
      "dimension": "Developer/Integration",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "note": "test mode + test clocks + sandbox webhooks universal"
        }
      ],
      "seedISC": "Exercise the full subscription lifecycle against provider test mode without charges",
      "notes": "Services 6/6; structurally invisible to the in-app cohort (UIs never surface sandbox mode) — a pure ISC-A2 catch."
    },
    {
      "id": "billing-contacts-role",
      "capability": "Billing contacts / view-only billing-email recipients",
      "dimension": "Admin/Governance",
      "tier": "T2",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 4,
          "of": 8,
          "note": "Slack, Figma, Intercom, Loom"
        }
      ],
      "seedISC": "Route billing email to designated view-only billing contacts distinct from admins"
    },
    {
      "id": "graduated-volume-pricing",
      "capability": "Tiered / graduated / volume quantity pricing",
      "dimension": "Plans/Pricing",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 4,
          "of": 6
        }
      ],
      "seedISC": "Price a plan by graduated or volume quantity tiers",
      "notes": "A pricing STRUCTURE distinct from usage metering; a per-seat kit may need volume tiers without being metered."
    }
  ],
  "antiCriteria": [
    {
      "id": "a-client-price-ids",
      "rule": "MUST NOT trust client-supplied price, plan, or amount ids at checkout",
      "why": "The server resolves price from the plan catalog; a client-set amount is a discount and fraud hole."
    },
    {
      "id": "a-entitlement-before-webhook",
      "rule": "MUST NOT grant paid entitlements before the provider webhook confirms payment",
      "why": "Optimistic grants hand out access on failed or abandoned charges; the webhook is the source of truth."
    },
    {
      "id": "a-store-raw-card",
      "rule": "MUST NOT store raw PAN/CVV or card data; hold only the provider token and last4",
      "why": "Raw card storage is a PCI-scope and breach liability the provider is built to absorb."
    },
    {
      "id": "a-failed-payment-keeps-access",
      "rule": "MUST NOT let a failed or past-due payment silently retain full access",
      "why": "Silent revenue leakage; past-due must gate access after the retry and grace window."
    },
    {
      "id": "a-client-proration",
      "rule": "MUST NOT compute proration, tax, or the charged amount on the client",
      "why": "Money math is server and provider authoritative; client math is spoofable and drifts from the invoice."
    },
    {
      "id": "a-webhook-no-verify",
      "rule": "MUST NOT act on billing webhooks without verifying signature and idempotency key",
      "why": "Unverified webhooks let an attacker forge payment events; non-idempotent handling double-applies them."
    },
    {
      "id": "a-cross-tenant-billing",
      "rule": "MUST NOT resolve a subscription, invoice, or usage record without org-scoping",
      "why": "A foreign org id must 404, not leak another tenant's billing state; tenancy comes from the session seam."
    },
    {
      "id": "a-webhook-ordering",
      "rule": "MUST NOT apply a webhook whose event is older than the record’s last-applied event; guard by provider event timestamp/version, not event-id dedup alone",
      "why": "Providers deliver events out of order; a stale subscription.updated overwriting newer state corrupts billing status, and replay-idempotency does not catch it."
    },
    {
      "id": "a-outbound-idempotency",
      "rule": "MUST send a stable idempotency key on every provider mutation (charge, subscription create/update)",
      "why": "A retried create-charge/create-subscription on a network retry double-charges the customer; the idempotency key makes the retry a no-op."
    },
    {
      "id": "a-money-float",
      "rule": "MUST store and compute money as integer minor units with an explicit currency, never as float",
      "why": "Floats drift totals from the provider’s authoritative integer minor-unit amounts, and 2-decimal assumptions break zero-decimal currencies like JPY."
    }
  ],
  "sources": [
    "https://vercel.com/docs/pricing/manage-and-optimize-usage",
    "https://slack.com/help/articles/218915087-Manage-your-Slack-plan-and-billing-details",
    "https://www.notion.com/help/invoices",
    "https://docs.github.com/en/billing/concepts/budgets-and-alerts",
    "https://www.intercom.com/help/en/articles/8991894-how-to-see-and-manage-your-usage",
    "https://support.atlassian.com/loom/docs/loom-billing-faq",
    "https://help.figma.com/hc/en-us/articles/360041061034-Manage-billing-on-the-Professional-plan",
    "https://www.intercom.com/help/en/articles/8344189-how-to-manage-your-intercom-subscription",
    "https://linear.app/docs/billing-and-plans",
    "https://docs.stripe.com/billing",
    "https://docs.stripe.com/billing/subscriptions/usage-based",
    "https://docs.stripe.com/tax",
    "https://docs.stripe.com/customer-management",
    "https://www.paddle.com/billing",
    "https://www.chargebee.com/subscription-management/",
    "https://recurly.com/product/",
    "https://docs.withorb.com/",
    "https://www.metacto.com/blogs/what-is-lemon-squeezy-a-comprehensive-guide-to-the-payments-platform",
    "https://www.lemonsqueezy.com/"
  ]
};

export default Billing;
