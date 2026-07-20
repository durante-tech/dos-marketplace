import type { Archetype } from '../Schema/Archetype';

export const AuditLog: Archetype = {
  "name": "audit-log",
  "title": "Audit Log \u2014 Feature Archetype Completeness Matrix",
  "cohorts": [
    {
      "id": "inapp",
      "label": "SaaS admin audit-log surfaces (in-app cohort, n=8)",
      "references": [
        "GitHub",
        "Slack",
        "Notion",
        "Google Workspace",
        "Stripe",
        "Okta",
        "Datadog",
        "HubSpot"
      ]
    },
    {
      "id": "services",
      "label": "Dedicated audit-log / audit-infrastructure vendors (services cohort, n=6)",
      "references": [
        "WorkOS",
        "Retraced",
        "Panther",
        "RunReveal",
        "Datadog Audit Trail",
        "Teleport"
      ]
    }
  ],
  "tierDefinitions": {
    "T1": "In-app cohort shipping >= 6/8 (a directly confirmed count, or the confirmed sub-count of a partially-inferred count when it is >= 6) \u2014 OR full services-cohort universality (shipping == of, i.e. 6/6 with zero unconfirmed slack), which overrides the in-app count entirely regardless of what the in-app cohort shows.",
    "T2": "In-app cohort shipping 4-5/8 (directly confirmed, or confirmed sub-count of an inferred count), with no universal-services override in play for this row.",
    "T3": "In-app cohort shipping <= 3/8, including 0/8 (a confirmed absence) and rows with zero in-app evidence at all (treated as in-app-0 by default per the law). Also the residual band for any inferred-only count whose confirmed sub-count falls below the T1/T2 thresholds, and for services-only counts below full universality (no in-app evidence exists to promote the row, and the override did not fire)."
  },
  "rows": [
    {
      "id": "admin-viewable-audit-log-ui",
      "capability": "Admin-viewable event/audit log UI surface",
      "dimension": "foundation",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 8,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization",
            "https://slack.com/help/articles/360000394286-Audit-logs-in-Slack",
            "https://www.notion.com/help/audit-log",
            "https://knowledge.workspace.google.com/admin/reports/admin-log-events",
            "https://docs.stripe.com/activity-logs",
            "https://support.okta.com/help/s/article/getting-started-with-okta-system-logs?language=en_US",
            "https://docs.datadoghq.com/account_management/audit_trail/",
            "https://knowledge.hubspot.com/account-management/view-and-export-account-activity-history"
          ],
          "inferred": false
        }
      ],
      "note": "Universal table stakes; Stripe's is a brand-new 2026 preview (availability begins 2026-04-01).",
      "seedISC": "Ship an admin-facing screen listing every audit event in the account"
    },
    {
      "id": "actor-field-schema",
      "capability": "Structured schema: actor field",
      "dimension": "schema",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 8,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization",
            "https://docs.slack.dev/admins/audit-logs-api/",
            "https://www.notion.com/help/audit-log",
            "https://knowledge.workspace.google.com/admin/reports/admin-log-events",
            "https://docs.stripe.com/activity-logs",
            "https://support.okta.com/help/s/article/getting-started-with-okta-system-logs?language=en_US",
            "https://docs.datadoghq.com/account_management/audit_trail/",
            "https://developers.hubspot.com/docs/api-reference/legacy/account/audit-logs/get-audit-logs"
          ],
          "inferred": false
        }
      ],
      "note": "Field name varies (actor / actingUser / actor email) but the concept is universal.",
      "seedISC": "Every audit event record must carry a resolvable actor field"
    },
    {
      "id": "action-type-field-schema",
      "capability": "Structured schema: action/event-type field",
      "dimension": "schema",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 8,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization",
            "https://docs.slack.dev/admins/audit-logs-api/",
            "https://www.notion.com/help/audit-log",
            "https://knowledge.workspace.google.com/admin/reports/admin-log-events",
            "https://docs.stripe.com/activity-logs",
            "https://support.okta.com/help/s/article/getting-started-with-okta-system-logs?language=en_US",
            "https://docs.datadoghq.com/account_management/audit_trail/",
            "https://developers.hubspot.com/docs/api-reference/legacy/account/audit-logs/get-audit-logs"
          ],
          "inferred": false
        }
      ],
      "note": "GitHub composes category.operation (e.g. repo.create); Okta uses eventType \u2014 same concept, different shape.",
      "seedISC": "Every audit event must carry a structured action or event-type field"
    },
    {
      "id": "target-resource-field-schema",
      "capability": "Structured schema: target/resource field",
      "dimension": "schema",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 8,
          "of": 8,
          "confirmed": 7,
          "refs": [
            "https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization",
            "https://docs.slack.dev/admins/audit-logs-api/",
            "https://www.notion.com/help/audit-log",
            "https://knowledge.workspace.google.com/admin/reports/admin-log-events",
            "https://docs.stripe.com/activity-logs",
            "https://support.okta.com/help/s/article/getting-started-with-okta-system-logs?language=en_US",
            "https://developers.hubspot.com/docs/api-reference/legacy/account/audit-logs/get-audit-logs",
            "https://docs.datadoghq.com/account_management/audit_trail/"
          ],
          "inferred": true
        }
      ],
      "note": "Datadog's target field is inferred from event naming, not explicitly labeled in the fetched docs \u2014 confirmed=7/8 clears the T1 band on its own.",
      "seedISC": "Every event should name the target resource that was acted upon"
    },
    {
      "id": "timestamp-field-schema",
      "capability": "Structured schema: timestamp field",
      "dimension": "schema",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 8,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization",
            "https://docs.slack.dev/admins/audit-logs-api/",
            "https://www.notion.com/help/audit-log",
            "https://knowledge.workspace.google.com/admin/reports/admin-log-events",
            "https://docs.stripe.com/activity-logs",
            "https://support.okta.com/help/s/article/getting-started-with-okta-system-logs?language=en_US",
            "https://docs.datadoghq.com/account_management/audit_trail/",
            "https://developers.hubspot.com/docs/api-reference/legacy/account/audit-logs/get-audit-logs"
          ],
          "inferred": false
        }
      ],
      "note": "ISO-8601-style created/occurredAt vs Unix date_create varies by vendor; the field itself is universal.",
      "seedISC": "Every audit event must carry a precise, sortable event timestamp field"
    },
    {
      "id": "filter-by-actor",
      "capability": "Filtering by actor/user",
      "dimension": "filtering-search",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 6,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization",
            "https://docs.slack.dev/admins/audit-logs-api/",
            "https://www.notion.com/help/audit-log",
            "https://knowledge.workspace.google.com/admin/reports/admin-log-events",
            "https://docs.datadoghq.com/account_management/audit_trail/",
            "https://knowledge.hubspot.com/account-management/view-and-export-account-activity-history"
          ],
          "inferred": false
        }
      ],
      "note": "Stripe's docs confirm actor filtering is explicitly NOT supported; Okta's status is unconfirmed in the fetched page.",
      "seedISC": "Let admins filter the audit log down to one specific actor"
    },
    {
      "id": "filter-by-action-type",
      "capability": "Filtering by action/event type",
      "dimension": "filtering-search",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 8,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization",
            "https://docs.slack.dev/admins/audit-logs-api/",
            "https://www.notion.com/help/audit-log",
            "https://knowledge.workspace.google.com/admin/reports/admin-log-events",
            "https://docs.stripe.com/activity-logs",
            "https://support.okta.com/help/s/article/getting-started-with-okta-system-logs?language=en_US",
            "https://docs.datadoghq.com/account_management/audit_trail/",
            "https://knowledge.hubspot.com/account-management/view-and-export-account-activity-history"
          ],
          "inferred": false
        }
      ],
      "note": "The single most consistently available filter axis in the cohort; Okta's SCIM-style eq expressions are the most expressive implementation.",
      "seedISC": "Let admins filter the audit log by action or event type"
    },
    {
      "id": "filter-by-date-range",
      "capability": "Filtering by date/time range",
      "dimension": "filtering-search",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 8,
          "of": 8,
          "confirmed": 6,
          "refs": [
            "https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization",
            "https://docs.slack.dev/admins/audit-logs-api/",
            "https://www.notion.com/help/audit-log",
            "https://knowledge.workspace.google.com/admin/reports/admin-log-events",
            "https://support.okta.com/help/s/article/getting-started-with-okta-system-logs?language=en_US",
            "https://knowledge.hubspot.com/account-management/view-and-export-account-activity-history",
            "https://docs.stripe.com/activity-logs",
            "https://docs.datadoghq.com/account_management/audit_trail/"
          ],
          "inferred": true
        }
      ],
      "note": "Stripe and Datadog's date-range support is implied (pagination-by-created, standard time-picker UI) but not directly quoted in the fetched pages; confirmed=6/8 still clears T1.",
      "seedISC": "Let admins filter or scope the audit log by a date range"
    },
    {
      "id": "freetext-nlq-search",
      "capability": "Free-text / natural-language search of log content",
      "dimension": "filtering-search",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 2,
          "of": 8,
          "refs": [
            "https://support.okta.com/help/s/article/getting-started-with-okta-system-logs?language=en_US",
            "https://docs.datadoghq.com/account_management/audit_trail/"
          ],
          "inferred": false
        },
        {
          "cohort": "services",
          "shipping": 2,
          "of": 6,
          "refs": [
            "https://docs.datadoghq.com/account_management/audit_trail/",
            "https://runreveal.com/"
          ],
          "inferred": false
        }
      ],
      "note": "Narrow in both cohorts \u2014 most vendors expose only structured field:value filtering, no NLQ over log content.",
      "seedISC": "Offer free-text or natural-language search over raw audit log content"
    },
    {
      "id": "csv-export",
      "capability": "CSV export of audit events",
      "dimension": "export-delivery",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 7,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization",
            "https://slack.com/help/articles/360000394286-Audit-logs-in-Slack",
            "https://www.notion.com/help/audit-log",
            "https://knowledge.workspace.google.com/admin/reports/admin-log-events",
            "https://support.okta.com/help/s/article/getting-started-with-okta-system-logs?language=en_US",
            "https://docs.datadoghq.com/account_management/audit_trail/",
            "https://knowledge.hubspot.com/account-management/view-and-export-account-activity-history"
          ],
          "inferred": false
        },
        {
          "cohort": "services",
          "shipping": 2,
          "of": 6,
          "refs": [
            "https://workos.com/docs/audit-logs",
            "https://docs.datadoghq.com/account_management/audit_trail/"
          ],
          "inferred": false
        }
      ],
      "note": "Stripe's export language is generic, not CSV-specific \u2014 no dashboard export button documented. Datadog and Google Workspace both cap export around 100,000 rows/events per download (30M with Google's gated security-investigation add-on) \u2014 document any export ceiling up front, it is a real operational constraint users hit.",
      "seedISC": "Let admins export the visible audit log to a CSV file"
    },
    {
      "id": "json-export-ui",
      "capability": "JSON export via UI download (distinct from raw API JSON)",
      "dimension": "export-delivery",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 2,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization",
            "https://slack.com/help/articles/360000394286-Audit-logs-in-Slack"
          ],
          "inferred": false
        }
      ],
      "note": "Distinct from raw API JSON responses (see api-access-to-events) \u2014 this is a manual UI export button specifically. Most vendors' manual-export paths are CSV-only.",
      "seedISC": "Offer a JSON download option in the audit log UI, not just CSV"
    },
    {
      "id": "api-access-to-events",
      "capability": "REST/GraphQL API access to audit events",
      "dimension": "export-delivery",
      "tier": "T2",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 5,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization",
            "https://docs.slack.dev/admins/audit-logs-api/",
            "https://docs.stripe.com/activity-logs",
            "https://support.okta.com/help/s/article/getting-started-with-okta-system-logs?language=en_US",
            "https://developers.hubspot.com/docs/api-reference/legacy/account/audit-logs/get-audit-logs"
          ],
          "inferred": false
        }
      ],
      "note": "Notion/Google Workspace/Datadog almost certainly have one too, just not confirmed in the specific pages fetched for this brief \u2014 a research gap, not a confirmed absence.",
      "seedISC": "Expose a REST or GraphQL API to pull raw audit events"
    },
    {
      "id": "siem-streaming-export",
      "capability": "Continuous streaming/webhook push of events to external SIEM",
      "dimension": "export-delivery",
      "tier": "T2",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 4,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/enterprise-cloud@latest/admin/monitoring-activity-in-your-enterprise/reviewing-audit-logs-for-your-enterprise/streaming-the-audit-log-for-your-enterprise",
            "https://www.notion.com/help/audit-log",
            "https://knowledge.workspace.google.com/admin/reports/admin-log-events",
            "https://docs.datadoghq.com/account_management/audit_trail/"
          ],
          "inferred": false
        }
      ],
      "note": "Slack and Stripe confirm this is NOT offered at any tier (Slack's API is poll-based by design; Stripe's docs state flatly 'Not supported'). Gated to the top plan at GitHub Enterprise Cloud and Notion Enterprise.",
      "seedISC": "Stream audit events continuously to an external SIEM via webhook"
    },
    {
      "id": "ip-address-capture",
      "capability": "IP address captured on events",
      "dimension": "schema",
      "tier": "T2",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 5,
          "of": 8,
          "refs": [
            "https://www.notion.com/help/audit-log",
            "https://knowledge.workspace.google.com/admin/reports/admin-log-events",
            "https://support.okta.com/help/s/article/getting-started-with-okta-system-logs?language=en_US",
            "https://docs.datadoghq.com/account_management/audit_trail/",
            "https://knowledge.hubspot.com/account-management/view-and-export-account-activity-history"
          ],
          "inferred": false
        }
      ],
      "note": "GitHub's fetch confirmed only a country qualifier (country:de), not an explicit raw IP field.",
      "seedISC": "Capture the originating IP address on every audit event record"
    },
    {
      "id": "device-ua-metadata-capture",
      "capability": "Device / user-agent metadata captured on events",
      "dimension": "schema",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 2,
          "of": 8,
          "refs": [
            "https://knowledge.workspace.google.com/admin/reports/admin-log-events",
            "https://knowledge.hubspot.com/account-management/view-and-export-account-activity-history"
          ],
          "inferred": false
        }
      ],
      "note": "Narrower than IP capture \u2014 Okta and Datadog confirm IP but not a distinct device/UA field in the fetched docs.",
      "seedISC": "Capture device type and user-agent metadata alongside each event"
    },
    {
      "id": "core-feature-enterprise-gated",
      "capability": "Core audit-log feature hard-gated to Enterprise-only plan",
      "dimension": "packaging-pricing",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 2,
          "of": 8,
          "refs": [
            "https://slack.com/help/articles/360000394286-Audit-logs-in-Slack",
            "https://www.notion.com/help/audit-log"
          ],
          "inferred": false
        }
      ],
      "note": "Slack and Notion hard-gate the entire feature to Enterprise \u2014 it doesn't exist at all below that tier. HubSpot instead partial-gates (base log at every tier, Approval/Content/Workflows categories and unlimited Content Hub retention reserved for Enterprise, 1/8 confirmed on the retention-tiering specifically) \u2014 plan-gating a shipped capability still counts as shipped for that capability's own row (audit-log is enterprise-gate-heavy by nature).",
      "seedISC": "Decide whether the audit log exists at all below Enterprise tier"
    },
    {
      "id": "self-service-configurable-retention-window",
      "capability": "Admin-adjustable/self-service retention window (not fixed by vendor)",
      "dimension": "retention-lifecycle",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 1,
          "of": 8,
          "refs": [
            "https://docs.datadoghq.com/account_management/audit_trail/"
          ],
          "inferred": false
        },
        {
          "cohort": "services",
          "shipping": 2,
          "of": 6,
          "refs": [
            "https://docs.datadoghq.com/account_management/audit_trail/",
            "https://runreveal.com/pricing"
          ],
          "inferred": false
        }
      ],
      "note": "Premium-notable: only Datadog offers this in-app (3/7/15/30/90-day admin picker, reverts to 7-day default if disabled); RunReveal tier-gates its own day-count presets (30/90/550), custom on Enterprise. Every other vendor in both cohorts ships one fixed, vendor-set window.",
      "seedISC": "Let admins choose their own audit-log retention window length"
    },
    {
      "id": "default-retention-90-days-plus",
      "capability": "Default retention meets/exceeds 90 days out of the box",
      "dimension": "retention-lifecycle",
      "tier": "T2",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 5,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization",
            "https://www.notion.com/help/audit-log",
            "https://docs.stripe.com/activity-logs",
            "https://support.okta.com/help/s/article/getting-started-with-okta-system-logs?language=en_US",
            "https://docs.datadoghq.com/account_management/audit_trail/"
          ],
          "inferred": false
        }
      ],
      "note": "HubSpot's standard log is the clear short-side outlier at 30 days (its Content Hub log runs far longer, see core-feature-enterprise-gated).",
      "seedISC": "Default the audit log retention window to 90 days or more"
    },
    {
      "id": "hard-delete-past-retention",
      "capability": "Data past retention window is hard-deleted / fully inaccessible",
      "dimension": "retention-lifecycle",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 2,
          "of": 8,
          "refs": [
            "https://support.okta.com/help/s/article/getting-started-with-okta-system-logs?language=en_US",
            "https://docs.stripe.com/activity-logs"
          ],
          "inferred": false
        }
      ],
      "note": "Both vendors recommend manual export before expiry as the only extended-access path \u2014 no paid 'keep it longer in-place' tier exists in either vendor's docs.",
      "seedISC": "Hard-delete events past the retention window with no recovery path"
    },
    {
      "id": "cursor-based-pagination-api",
      "capability": "Cursor/token-based pagination for API results",
      "dimension": "reliability",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 3,
          "of": 8,
          "refs": [
            "https://docs.stripe.com/activity-logs",
            "https://support.okta.com/help/s/article/getting-started-with-okta-system-logs?language=en_US",
            "https://developers.hubspot.com/docs/api-reference/legacy/account/audit-logs/get-audit-logs"
          ],
          "inferred": false
        }
      ],
      "note": "Slack's own docs explicitly flag pagination as unspecified for its Audit Logs API \u2014 a documented consumer-facing gap, not an inferred one.",
      "seedISC": "Paginate the events API with a cursor or continuation token"
    },
    {
      "id": "streaming-delivery-reliability-guarantees",
      "capability": "Documented delivery guarantee + buffering/replay window for streamed events",
      "dimension": "reliability",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 1,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/enterprise-cloud@latest/admin/monitoring-activity-in-your-enterprise/reviewing-audit-logs-for-your-enterprise/streaming-the-audit-log-for-your-enterprise"
          ],
          "inferred": false
        }
      ],
      "note": "Premium-notable: GitHub is the only vendor documenting at-least-once delivery (consumers must dedup) plus a 7-day buffer/replay window for a downed destination, with data loss only past three weeks of downtime. No equivalent detail surfaced for other vendors' streaming paths in the fetched docs.",
      "seedISC": "Document delivery guarantees and a buffering window for streamed events",
      "notes": "premium-notable: sole documented delivery-SLA for audit streaming (GitHub); differentiator for SIEM integrations"
    },
    {
      "id": "builtin-anomaly-detection-on-log-stream",
      "capability": "Built-in anomaly/suspicious-activity detection layered on the raw event stream",
      "dimension": "intelligence-analytics",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 1,
          "of": 8,
          "refs": [
            "https://slack.com/help/articles/360000394286-Audit-logs-in-Slack"
          ],
          "inferred": false
        }
      ],
      "note": "Premium-notable: Slack's 'Anomaly events' Security Detections tab is the only cohort member surfacing log-derived suspicious-activity signals rather than just a raw event list.",
      "seedISC": "Layer built-in anomaly detection on top of the raw event stream"
    },
    {
      "id": "non-human-actor-attribution",
      "capability": "Non-human actor (bot/integration/app) distinctly identified as event source",
      "dimension": "schema",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 3,
          "of": 8,
          "refs": [
            "https://www.notion.com/help/audit-log",
            "https://docs.slack.dev/admins/audit-logs-api/",
            "https://knowledge.workspace.google.com/admin/reports/admin-log-events"
          ],
          "inferred": false
        }
      ],
      "note": "Other vendors' fetched schemas describe a human actor field without confirming bot/integration attribution in the excerpts pulled.",
      "seedISC": "Distinctly identify bots, integrations, or agents as the event actor"
    },
    {
      "id": "dedicated-service-actor-action-target-schema",
      "capability": "Named actor/action/target event-schema fields (dedicated audit-log services)",
      "dimension": "schema",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 4,
          "of": 6,
          "refs": [
            "https://workos.com/docs/audit-logs",
            "https://raw.githubusercontent.com/retracedhq/retraced/master/README.md",
            "https://docs.datadoghq.com/security/audit_trail/",
            "https://goteleport.com/docs/reference/audit-events/"
          ],
          "inferred": false
        }
      ],
      "note": "Panther/RunReveal normalize into a generic schema instead of naming the triad explicitly. Retraced additionally tags explicit CRUD create/read/update/delete classification (1/6) on top of this triad; WorkOS/Retraced add a group/tenant scoping field (2/6, WorkOS org-scoped storage, Retraced dedicated group field); Teleport differentiates success vs. failure within one event-type code via a shared code prefix (e.g. TAL001I vs TAL001E, 1/6) \u2014 all folded here as schema-design refinements rather than separate rows.",
      "seedISC": "Ship a named actor/action/target schema triad for third-party audit events"
    },
    {
      "id": "workos-schema-and-ingestion-controls",
      "capability": "Custom/versionable event-metadata schema with idempotent ingestion",
      "dimension": "schema",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 1,
          "of": 6,
          "refs": [
            "https://workos.com/docs/audit-logs"
          ],
          "inferred": false
        }
      ],
      "note": "Premium-notable: WorkOS is the only vendor confirming BOTH a dashboard-defined, versioned custom event schema AND an idempotency-key header preventing duplicate-event writes on ingestion.",
      "seedISC": "Support dashboard-defined, versionable custom event schemas with idempotent ingestion",
      "notes": "premium-notable: schema governance from the purest dedicated vendor (WorkOS)"
    },
    {
      "id": "embeddable-audit-log-viewer-ui",
      "capability": "Embeddable, customer-facing audit-log viewer UI",
      "dimension": "foundation",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 2,
          "of": 6,
          "refs": [
            "https://workos.com/docs/audit-logs",
            "https://raw.githubusercontent.com/retracedhq/retraced/master/README.md"
          ],
          "inferred": false
        }
      ],
      "note": "Panther/RunReveal/Datadog/Teleport ship internal security-admin consoles, not a widget a third party embeds for its own end customers.",
      "seedISC": "Ship an embeddable audit-log viewer UI a customer can white-label"
    },
    {
      "id": "deployment-model-coverage",
      "capability": "Fully managed SaaS deployment",
      "dimension": "deployment-infra",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 5,
          "of": 6,
          "refs": [
            "https://workos.com/pricing",
            "https://panther.com/",
            "https://runreveal.com/pricing",
            "https://docs.datadoghq.com/account_management/audit_trail/",
            "https://goteleport.com/docs/zero-trust-access/management/external-audit-storage/"
          ],
          "inferred": false
        }
      ],
      "note": "Retraced is the outlier \u2014 self-hosted only in the docs reviewed (Docker/Kubernetes/Helm/Kustomize), no confirmed managed-cloud SKU; Teleport also supports a local on-prem storage backend. Self-hosted/on-prem as an explicit deployment option is confirmed for Retraced + Teleport (2/6 separately).",
      "seedISC": "Offer a fully managed SaaS deployment of the audit-log service",
      "notes": "count rests materially on category-adjacent roster members (SIEM/PAM scope-mismatch \u2014 see mint record); pure-fit vendors do not ship this"
    },
    {
      "id": "streaming-export-multi-destination",
      "capability": "Streaming export to named SIEM/warehouse platforms (Splunk, Sentinel, Datadog, Snowflake)",
      "dimension": "export-delivery",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 1,
          "of": 6,
          "refs": [
            "https://workos.com/docs/audit-logs/log-streams"
          ],
          "inferred": false
        }
      ],
      "note": "Premium-notable: WorkOS is the only vendor confirming built-in streaming to all four named destinations \u2014 Splunk via HEC, Microsoft Sentinel via Azure Monitor Logs Ingestion API, Datadog via the Log Intake API (regional endpoints), and Snowflake via RSA key-pair auth \u2014 a materially broader integration surface than any other vendor in this cohort.",
      "seedISC": "Stream audit events to Splunk, Sentinel, Datadog, and Snowflake natively"
    },
    {
      "id": "cloud-storage-archival-export",
      "capability": "Streaming/archival export to cloud object storage (S3/GCS/Azure)",
      "dimension": "export-delivery",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 3,
          "of": 6,
          "refs": [
            "https://workos.com/docs/audit-logs/log-streams",
            "https://docs.datadoghq.com/account_management/audit_trail/",
            "https://goteleport.com/docs/zero-trust-access/management/external-audit-storage/"
          ],
          "inferred": false
        }
      ],
      "note": "WorkOS covers S3+GCS via log streams; Datadog covers S3/GCS/Azure; Teleport's S3 variant is materially richer \u2014 Parquet files plus an Athena/Glue schema catalog. WorkOS's export additionally uses STS assume-role with external-ID validation and ContentMD5 headers for Object-Lock-enabled destination buckets (1/6, cross-account IAM hardening), folded in here as an export-security detail rather than a separate row.",
      "seedISC": "Archive audit events to S3, GCS, or Azure object storage"
    },
    {
      "id": "sql-query-engine-access",
      "capability": "SQL/query-engine access over stored events",
      "dimension": "intelligence-analytics",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 3,
          "of": 6,
          "refs": [
            "https://goteleport.com/docs/zero-trust-access/management/external-audit-storage/",
            "https://runreveal.com/",
            "https://panther.com/"
          ],
          "inferred": false
        }
      ],
      "note": "Teleport via Athena/Glue over Parquet; RunReveal via SQL-powered dashboards; Panther via a Snowflake-backed security data lake queried through detection rules.",
      "seedISC": "Let customers run SQL queries directly over stored audit events",
      "notes": "count rests materially on category-adjacent roster members (SIEM/PAM scope-mismatch \u2014 see mint record); pure-fit vendors do not ship this"
    },
    {
      "id": "full-session-recording-replay",
      "capability": "Full session recording / replay of privileged sessions",
      "dimension": "intelligence-analytics",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 1,
          "of": 6,
          "refs": [
            "https://goteleport.com/docs/zero-trust-access/management/external-audit-storage/",
            "https://goteleport.com/docs/reference/architecture/session-recording/"
          ],
          "inferred": false
        }
      ],
      "note": "Premium-notable, category-defining: no other cohort vendor records or replays entire sessions, only discrete events. Teleport further ships syscall/BPF-level enhanced recording (1/6, search-sourced) as a deeper variant of this same capability.",
      "seedISC": "Offer full session recording and replay of privileged user sessions",
      "notes": "count rests materially on category-adjacent roster members (SIEM/PAM scope-mismatch \u2014 see mint record); pure-fit vendors do not ship this"
    },
    {
      "id": "detection-as-code",
      "capability": "Detection-as-code (version-controlled, CI/CD-integrated rules)",
      "dimension": "intelligence-analytics",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 2,
          "of": 6,
          "refs": [
            "https://panther.com/",
            "https://runreveal.com/"
          ],
          "inferred": false
        }
      ],
      "note": "Panther's rules are Python-based; both integrate with version control/CI. Panther separately documents human-approval-gated logging of its own AI agent's actions (1/6) \u2014 a governance capability auditing the platform itself rather than a customer's app; noted here as an adjacent but structurally different finding, not folded into the count.",
      "seedISC": "Let security teams write detection rules as version-controlled code",
      "notes": "count rests materially on category-adjacent roster members (SIEM/PAM scope-mismatch \u2014 see mint record); pure-fit vendors do not ship this"
    },
    {
      "id": "ai-assisted-incident-investigation",
      "capability": "AI-assisted natural-language incident investigation",
      "dimension": "intelligence-analytics",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 1,
          "of": 6,
          "refs": [
            "https://runreveal.com/"
          ],
          "inferred": false
        }
      ],
      "note": "Premium-notable: RunReveal markets this as turning 'hours of manual log analysis into minutes' \u2014 distinct from the narrower NL search-query translation capability (see freetext-nlq-search).",
      "seedISC": "Add an AI assistant that investigates incidents from natural language",
      "notes": "premium-notable: emerging class marker"
    },
    {
      "id": "compliance-positioning-and-certification",
      "capability": "Compliance framing of the audit log + vendor's own compliance certification",
      "dimension": "compliance-trust",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 2,
          "of": 8,
          "refs": [
            "https://docs.stripe.com/activity-logs",
            "https://docs.datadoghq.com/account_management/audit_trail/"
          ],
          "inferred": false
        },
        {
          "cohort": "services",
          "shipping": 5,
          "of": 6,
          "refs": [
            "https://workos.com/security",
            "https://panther.com/security",
            "https://runreveal.com/",
            "https://goteleport.com/blog/soc2-iso-27001-hipaa/"
          ],
          "inferred": true,
          "confirmed": 4
        }
      ],
      "note": "In-app docs framing: only Stripe (names SOC 2/PCI DSS) and Datadog (names HIPAA/PCI/SOX/GDPR) frame the audit log as a named-framework compliance artifact; the rest describe it operationally. Vendor's-own-certification (services cohort): SOC 2 Type II confirmed for WorkOS/Panther/RunReveal/Teleport (4/6 \u2014 Datadog's is publicly known but not confirmed in the fetched pages; Retraced is self-hosted OSS, compliance posture depends on the operator, not the vendor). Also confirmed: ISO 27001 for Panther/Teleport (2/6); HIPAA/BAA for WorkOS (Enterprise-plan-only) and Teleport (2/6); PCI DSS for Panther/Datadog/Teleport (3/6) \u2014 folded here as related certification facts rather than separate rows.",
      "seedISC": "Name specific compliance frameworks and hold your own SOC 2 attestation",
      "notes": "union count 5/6 incl. Datadog (PCI-only, inferred toward the union); Retraced is N/A-not-zero (self-hosted, certs operator-dependent) yet counted in the of:6 denominator \u2014 declared"
    },
    {
      "id": "vendor-fedramp-pathway",
      "capability": "FedRAMP compliance pathway",
      "dimension": "compliance-trust",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 1,
          "of": 6,
          "refs": [
            "https://goteleport.com/docs/zero-trust-access/compliance-frameworks/fedramp/"
          ],
          "inferred": false
        }
      ],
      "note": "Premium-notable, single-vendor: the only government-compliance-grade option in the roster; Teleport gates it to its Enterprise tier and pairs it with FIPS 140 support.",
      "seedISC": "Offer a FedRAMP compliance pathway with FIPS 140 support",
      "notes": "premium-notable: regulated-market gate"
    }
  ],
  "antiCriteria": [
    {
      "id": "a-mutable-deletable-audit-rows",
      "rule": "Audit event rows must never be editable or deletable after write \u2014 no UPDATE/DELETE path on stored events.",
      "why": "mutable or deletable audit rows destroy the evidentiary value the log exists for; guards append-only-event-storage and tamper-evidence rows (0/6 vendors document any mutation path)"
    },
    {
      "id": "a-log-secrets-pii-in-payloads",
      "rule": "Never write raw secrets, credentials, or unredacted PII into audit event payloads or metadata.",
      "why": "Field-level redaction of sensitive data in events is unconfirmed across all 6 dedicated services in live docs (0/6) \u2014 Retraced's founding team holds a patent titled 'Verifiable redactable audit log' suggesting the idea was part of the original design lineage, but it is not documented as a shipped feature for any vendor here. Guards: workos-schema-and-ingestion-controls, dedicated-service-actor-action-target-schema."
    },
    {
      "id": "a-viewer-only-no-export",
      "rule": "Never ship the admin audit-log viewer without a paired export or API path.",
      "why": "The admin-viewable UI is universal (8/8 in-app) and CSV export ships alongside it at 7/8, with API access at 5/8 confirmed \u2014 a view-only implementation would sit well below this cohort's baseline pairing of viewing with export. Guards: admin-viewable-audit-log-ui, csv-export, api-access-to-events."
    },
    {
      "id": "a-assume-full-historical-backfill",
      "rule": "Never assume enabling audit logging retroactively backfills events from before the enrollment date.",
      "why": "Notion's docs explicitly confirm 'Events are recorded starting from the upgrade date; prior history is not included,' and Slack's docs carry a weaker but real caveat that availability of prior data depends on the previous plan. Guards: admin-viewable-audit-log-ui, default-retention-90-days-plus."
    },
    {
      "id": "a-undocumented-api-pagination",
      "rule": "Never ship an audit-events API without a documented pagination mechanism.",
      "why": "Slack's own fetched docs explicitly flag that filtering parameters and pagination mechanisms are 'not specified' for its Audit Logs API \u2014 a documented gap, not an inferred one, that API consumers hit directly. Guards: api-access-to-events, cursor-based-pagination-api."
    },
    {
      "id": "a-no-streaming-buffer-on-outage",
      "rule": "Never stream audit events to an external destination without a buffering/replay window for outages.",
      "why": "GitHub is the only vendor in the in-app cohort documenting a buffer (7-day) and a data-loss cutoff (three weeks) for a downed streaming destination \u2014 the other vendors offering streaming (Notion, Google Workspace, Datadog) don't surface this detail in the fetched docs, marking it a real design risk rather than a solved problem. Guards: siem-streaming-export, streaming-delivery-reliability-guarantees, streaming-export-multi-destination."
    },
    {
      "id": "a-hard-gate-entire-feature-not-baseline",
      "rule": "Never hard-gate the entire audit-log feature to the top plan when a baseline-everywhere-plus-deeper-tiers model is achievable.",
      "why": "Slack and Notion hard-gate audit logging's existence to Enterprise (2/8); HubSpot instead ships a baseline log at every tier and reserves only deeper filter categories and longer Content Hub retention for Enterprise \u2014 a documented alternative packaging model in the same cohort. Guards: core-feature-enterprise-gated."
    },
    {
      "id": "a-unclear-delivery-guarantee-no-dedup",
      "rule": "Never claim streamed events are delivered exactly once without a documented guarantee.",
      "why": "GitHub explicitly documents at-least-once delivery with the caveat that 'some events may be duplicated due to network or system issues,' requiring consumer-side dedup \u2014 no other vendor's streaming path in the fetched docs states its delivery guarantee at all. Guards: streaming-delivery-reliability-guarantees, siem-streaming-export."
    },
    {
      "id": "a-single-filter-axis-only",
      "rule": "Never ship action-type filtering alone without actor and date-range filtering alongside it.",
      "why": "Action-type filtering is the one universally available axis (8/8), but actor filtering (6/8, with Stripe confirmed unsupported) and date-range filtering (confirmed 6/8) are each narrower \u2014 shipping only one axis falls short of the cohort's typical three-axis baseline. Guards: filter-by-actor, filter-by-action-type, filter-by-date-range."
    },
    {
      "id": "a-retention-expiry-without-export",
      "rule": "MUST NOT let audit events expire past retention without a documented export path or pre-expiry warning",
      "why": "silent compliance-data loss at the retention boundary; guards retention-window rows whose own notes state manual export is the only preservation path (Okta/Stripe table lines)"
    }
  ],
  "sources": [
    "https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization",
    "https://docs.github.com/en/enterprise-cloud@latest/admin/monitoring-activity-in-your-enterprise/reviewing-audit-logs-for-your-enterprise/streaming-the-audit-log-for-your-enterprise",
    "https://docs.slack.dev/admins/audit-logs-api/",
    "https://slack.com/help/articles/360000394286-Audit-logs-in-Slack",
    "https://www.notion.com/help/audit-log",
    "https://knowledge.workspace.google.com/admin/reports/admin-log-events",
    "https://docs.stripe.com/activity-logs",
    "https://support.okta.com/help/s/article/getting-started-with-okta-system-logs?language=en_US",
    "https://docs.datadoghq.com/account_management/audit_trail/",
    "https://knowledge.hubspot.com/account-management/view-and-export-account-activity-history",
    "https://developers.hubspot.com/docs/api-reference/legacy/account/audit-logs/get-audit-logs",
    "https://workos.com/docs/audit-logs",
    "https://workos.com/security",
    "https://workos.com/pricing",
    "https://workos.com/docs/audit-logs/log-streams",
    "https://github.com/retracedhq/retraced",
    "https://raw.githubusercontent.com/retracedhq/retraced/master/README.md",
    "https://panther.com/",
    "https://panther.com/security",
    "https://github.com/panther-labs/panther-analysis",
    "https://runreveal.com/",
    "https://runreveal.com/pricing",
    "https://runreveal.com/security",
    "https://docs.datadoghq.com/security/audit_trail/",
    "https://goteleport.com/docs/reference/audit-events/",
    "https://goteleport.com/docs/zero-trust-access/management/external-audit-storage/",
    "https://goteleport.com/docs/reference/architecture/session-recording/",
    "https://goteleport.com/docs/enroll-resources/server-access/guides/bpf-session-recording/",
    "https://goteleport.com/blog/soc2-iso-27001-hipaa/",
    "https://goteleport.com/docs/zero-trust-access/compliance-frameworks/",
    "https://goteleport.com/docs/zero-trust-access/compliance-frameworks/fedramp/"
  ],
  "version": "0.1.0",
  "updated": "2026-07-10"
};

export default AuditLog;
