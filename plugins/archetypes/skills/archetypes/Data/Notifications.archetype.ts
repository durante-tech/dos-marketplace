/**
 * User Notifications archetype — 4th corpus member, Stage-1 falsification
 * battery #2 (operator writ 2026-07-09). Two live-doc cohorts mined
 * 2026-07-09; gen-24 recipe law incl. the canonical synthesis contract
 * block (first measured use: ZERO contract-class encoding findings).
 * Step-4b skeptic: 7 findings — 5 applied, 2 explained (adjudication
 * provenance). Field record: archer/MUTATIONS/field-mint-notifications.md.
 */
import type { Archetype } from '../Schema/Archetype';

const Notifications: Archetype = {
  "name": "notifications",
  "title": "User Notifications",
  "version": "0.1.1",
  "updated": "2026-07-10",
  "cohorts": [
    {
      "id": "inapp",
      "label": "In-app notification systems (sets user expectations)",
      "references": [
        "GitHub",
        "Slack",
        "Linear",
        "Notion",
        "Asana",
        "Figma",
        "Intercom",
        "Jira"
      ]
    },
    {
      "id": "services",
      "label": "Dedicated notification platforms (API-tier norms; universal here forces T1)",
      "references": [
        "Knock",
        "Novu",
        "Courier",
        "OneSignal",
        "MagicBell",
        "Braze"
      ]
    }
  ],
  "tierDefinitions": {
    "T1": ">=6/8 inapp OR universal across the notification-services cohort — unconditional override, in-app UIs hide backend capabilities; demoting a universal capability requires a groundingException. Absence reads as broken/unfinished. MUST be built or deferred-with-ledger-row; silent absence is the failure.",
    "T2": "majority of in-app references (4-5/8). Absence is a known limitation users ask about within weeks. Deferral needs a one-line reason.",
    "T3": "rare or absent (<=3/8 in-app, including 0 and rows with no in-app evidence at all, unless the universality override applies). Optional; building one while T1 rows are silent-absent is the anti-pattern. (A declared groundingException in the row data — never inferred by a reviewer — is the only other path to T1.)"
  },
  "rows": [
    {
      "id": "in-app-inbox",
      "capability": "In-app notification inbox / activity feed",
      "dimension": "ux-surface",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 4,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications",
            "https://linear.app/docs/inbox",
            "https://www.notion.com/help/notification-settings",
            "https://help.figma.com/hc/en-us/articles/360039813234-Manage-your-notification-preferences"
          ],
          "inferred": false
        },
        {
          "cohort": "inapp",
          "shipping": 4,
          "of": 8,
          "refs": [
            "https://slack.com/help/articles/360056534254-Manage-notifications-for-specific-channels-and-direct-messages",
            "https://help.asana.com/s/article/notification-settings",
            "https://www.intercom.com/help/en/articles/187-how-teammates-get-notifications",
            "https://support.atlassian.com/jira-software-cloud/docs/manage-your-jira-personal-settings/"
          ],
          "inferred": true
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://docs.knock.app/",
            "https://docs.novu.co/",
            "https://www.courier.com/docs",
            "https://documentation.onesignal.com/docs",
            "https://www.magicbell.com/docs",
            "https://www.braze.com/docs/user_guide/messaging/messaging_fundamentals/frequency_capping"
          ],
          "inferred": false
        }
      ],
      "seedISC": "Ship a persistent in-app inbox surfacing every triggered notification event"
    },
    {
      "id": "unread-badge-count",
      "capability": "Unread badge / count indicator",
      "dimension": "ux-surface",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 8,
          "of": 8,
          "refs": [
            "https://slack.com/help/articles/360056534254-Manage-notifications-for-specific-channels-and-direct-messages",
            "https://www.notion.com/help/notification-settings",
            "https://help.figma.com/hc/en-us/articles/360039813234-Manage-your-notification-preferences"
          ],
          "inferred": true,
          "confirmed": 3,
          "note": "3/8 doc-confirmed + 5 inferred from ubiquitous product UI (table stars)"
        },
        {
          "cohort": "inapp",
          "shipping": 5,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications",
            "https://linear.app/docs/notifications",
            "https://help.asana.com/s/article/notification-settings",
            "https://www.intercom.com/help/en/articles/187-how-teammates-get-notifications",
            "https://support.atlassian.com/jira-software-cloud/docs/manage-your-jira-personal-settings/"
          ],
          "inferred": true
        }
      ],
      "seedISC": "Show unread badge count that decrements accurately across every client surface",
      "groundingException": "badge counts universal in practice; table: 3 doc-confirmed + 5 UI-inferred — doc-thin table-stakes, declared"
    },
    {
      "id": "email-notification-channel",
      "capability": "Email notification channel",
      "dimension": "channel",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 7,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications",
            "https://linear.app/docs/notifications",
            "https://www.notion.com/help/notification-settings",
            "https://help.asana.com/s/article/email-notifications?language=en_US",
            "https://help.figma.com/hc/en-us/articles/360041547813-Manage-email-notifications-for-comments-on-files",
            "https://www.intercom.com/help/en/articles/187-how-teammates-get-notifications",
            "https://support.atlassian.com/jira-software-cloud/docs/manage-your-jira-personal-settings/"
          ],
          "inferred": false
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://docs.knock.app/",
            "https://docs.novu.co/",
            "https://www.courier.com/docs",
            "https://documentation.onesignal.com/docs",
            "https://www.magicbell.com/docs",
            "https://www.braze.com/docs/user_guide/messaging/messaging_fundamentals/frequency_capping"
          ],
          "inferred": false
        }
      ],
      "seedISC": "Deliver email notifications with a working, honored unsubscribe path"
    },
    {
      "id": "per-event-topic-preferences",
      "capability": "Per-event-type / per-topic notification preferences",
      "dimension": "preferences",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 7,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications",
            "https://linear.app/docs/notifications",
            "https://www.notion.com/help/notification-settings",
            "https://help.asana.com/s/article/email-notifications?language=en_US",
            "https://help.figma.com/hc/en-us/articles/360039813234-Manage-your-notification-preferences",
            "https://www.intercom.com/help/en/articles/187-how-teammates-get-notifications",
            "https://support.atlassian.com/jira-software-cloud/docs/manage-your-jira-personal-settings/"
          ],
          "inferred": false
        },
        {
          "cohort": "services",
          "shipping": 2,
          "of": 6,
          "refs": [
            "https://docs.knock.app/",
            "https://www.courier.com/docs"
          ],
          "inferred": false
        }
      ],
      "seedISC": "Let users opt in or out per distinct notification event type"
    },
    {
      "id": "per-channel-preference-matrix",
      "capability": "Per-channel delivery-method preference matrix (email/in-app/push/mobile)",
      "dimension": "preferences",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 8,
          "of": 8,
          "refs": [
            "https://linear.app/docs/notifications",
            "https://slack.com/help/articles/360056534254-Manage-notifications-for-specific-channels-and-direct-messages",
            "https://help.figma.com/hc/en-us/articles/360039813234-Manage-your-notification-preferences",
            "https://www.intercom.com/help/en/articles/187-how-teammates-get-notifications",
            "https://www.notion.com/help/notification-settings",
            "https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications",
            "https://support.atlassian.com/jira-software-cloud/docs/manage-your-jira-personal-settings/",
            "https://help.asana.com/s/article/email-notifications?language=en_US"
          ],
          "inferred": false
        },
        {
          "cohort": "services",
          "shipping": 4,
          "of": 6,
          "refs": [
            "https://docs.knock.app/",
            "https://docs.novu.co/",
            "https://www.courier.com/docs",
            "https://www.magicbell.com/docs"
          ],
          "inferred": false
        }
      ],
      "seedISC": "Expose an independent on/off toggle per delivery channel, per user"
    },
    {
      "id": "mute-per-object",
      "capability": "Mute notifications per object (channel/file/project/conversation)",
      "dimension": "user-control",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 6,
          "of": 8,
          "refs": [
            "https://slack.com/help/articles/360056534254-Manage-notifications-for-specific-channels-and-direct-messages",
            "https://help.figma.com/hc/en-us/articles/360039813234-Manage-your-notification-preferences",
            "https://help.asana.com/s/article/notification-settings",
            "https://support.atlassian.com/jira-cloud-administration/docs/configure-notification-schemes/",
            "https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications"
          ],
          "inferred": true,
          "note": "split per table: Slack/Figma/Jira/GitHub doc-confirmed, Asana/Notion/Linear inferred, Intercom not shipping (skeptic F5; inferred flag = partial-inference convention)"
        }
      ],
      "seedISC": "Allow muting a specific object without silencing all notifications globally"
    },
    {
      "id": "digest-batched-delivery",
      "capability": "Digest / batched notification delivery",
      "dimension": "delivery-control",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 6,
          "of": 8,
          "refs": [
            "https://linear.app/docs/notifications",
            "https://www.notion.com/help/notification-settings",
            "https://help.asana.com/s/article/email-notifications?language=en_US",
            "https://help.figma.com/hc/en-us/articles/360041547813-Manage-email-notifications-for-comments-on-files",
            "https://support.atlassian.com/jira-software-cloud/docs/manage-your-jira-personal-settings/",
            "https://www.intercom.com/help/en/articles/187-how-teammates-get-notifications"
          ],
          "inferred": false
        },
        {
          "cohort": "services",
          "shipping": 3,
          "of": 6,
          "refs": [
            "https://docs.knock.app/",
            "https://docs.novu.co/framework/digest",
            "https://www.magicbell.com/docs"
          ],
          "inferred": false
        }
      ],
      "seedISC": "Batch rapid repeated events into a single collapsed digest send"
    },
    {
      "id": "mobile-push-notifications",
      "capability": "Mobile push notifications",
      "dimension": "channel",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 6,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications",
            "https://www.notion.com/help/notification-settings",
            "https://help.figma.com/hc/en-us/articles/360039813234-Manage-your-notification-preferences",
            "https://www.intercom.com/help/en/articles/187-how-teammates-get-notifications",
            "https://slack.com/help/articles/360056534254-Manage-notifications-for-specific-channels-and-direct-messages",
            "https://linear.app/docs/notifications"
          ],
          "inferred": false
        },
        {
          "cohort": "inapp",
          "shipping": 1,
          "of": 8,
          "refs": [
            "https://help.asana.com/s/article/email-notifications?language=en_US"
          ],
          "inferred": true
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://docs.knock.app/",
            "https://docs.novu.co/",
            "https://www.courier.com/docs",
            "https://documentation.onesignal.com/docs",
            "https://www.magicbell.com/docs",
            "https://www.braze.com/docs/user_guide/messaging/messaging_fundamentals/frequency_capping"
          ],
          "inferred": false
        }
      ],
      "seedISC": "Deliver time-sensitive events as native mobile push notifications"
    },
    {
      "id": "desktop-browser-push-notifications",
      "capability": "Desktop / browser push notifications",
      "dimension": "channel",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 5,
          "of": 8,
          "refs": [
            "https://slack.com/help/articles/360056534254-Manage-notifications-for-specific-channels-and-direct-messages",
            "https://help.figma.com/hc/en-us/articles/360039813234-Manage-your-notification-preferences",
            "https://www.intercom.com/help/en/articles/187-how-teammates-get-notifications",
            "https://www.notion.com/help/notification-settings",
            "https://linear.app/docs/notifications"
          ],
          "inferred": false
        },
        {
          "cohort": "inapp",
          "shipping": 1,
          "of": 8,
          "refs": [
            "https://help.asana.com/s/article/email-notifications?language=en_US"
          ],
          "inferred": true
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://docs.knock.app/",
            "https://docs.novu.co/",
            "https://www.courier.com/docs",
            "https://documentation.onesignal.com/docs",
            "https://www.magicbell.com/docs",
            "https://www.braze.com/docs/user_guide/messaging/messaging_fundamentals/frequency_capping"
          ],
          "inferred": false
        }
      ],
      "seedISC": "Offer desktop/browser push distinct from the in-app inbox surface"
    },
    {
      "id": "mention-privileged-class",
      "capability": "@mention privileged notification class",
      "dimension": "delivery-control",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 6,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications",
            "https://linear.app/docs/notifications",
            "https://www.notion.com/help/notification-settings",
            "https://help.asana.com/s/article/email-notifications?language=en_US",
            "https://help.figma.com/hc/en-us/articles/360039813234-Manage-your-notification-preferences",
            "https://support.atlassian.com/jira-software-cloud/docs/manage-your-jira-personal-settings/"
          ],
          "inferred": false
        },
        {
          "cohort": "inapp",
          "shipping": 2,
          "of": 8,
          "refs": [
            "https://www.intercom.com/help/en/articles/187-how-teammates-get-notifications"
          ],
          "inferred": true,
          "note": "count 2 = Intercom (cited) + Slack (table prose, uncited) — skeptic F4"
        }
      ],
      "seedISC": "Route @mentions through delivery immediate and harder to fully suppress"
    },
    {
      "id": "watch-subscribe-per-object",
      "capability": "Watch / subscribe per object (issue, page, file, task)",
      "dimension": "user-control",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 6,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/subscriptions-and-notifications/concepts/about-notifications",
            "https://linear.app/docs/notifications",
            "https://support.atlassian.com/jira-software-cloud/docs/manage-your-jira-personal-settings/"
          ],
          "inferred": true,
          "confirmed": 3,
          "note": "3 doc-confirmed + 3 inferred; Intercom/Slack excluded (model mismatch per table)"
        },
        {
          "cohort": "inapp",
          "shipping": 3,
          "of": 8,
          "refs": [
            "https://www.notion.com/help/notification-settings",
            "https://help.asana.com/s/article/notification-settings",
            "https://help.figma.com/hc/en-us/articles/360039813234-Manage-your-notification-preferences"
          ],
          "inferred": true
        }
      ],
      "seedISC": "Let a user explicitly watch or subscribe to a single object",
      "groundingException": "6/8 with 3 members UI-inferred (table notes) — declared partial inference at the T1 bar"
    },
    {
      "id": "sms-delivery-channel",
      "capability": "SMS delivery channel",
      "dimension": "channel",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://docs.knock.app/",
            "https://docs.novu.co/",
            "https://www.courier.com/docs",
            "https://documentation.onesignal.com/docs",
            "https://www.magicbell.com/docs",
            "https://www.braze.com/docs/user_guide/messaging/messaging_fundamentals/frequency_capping"
          ],
          "inferred": false
        }
      ],
      "seedISC": "Support SMS as a notification delivery channel, carrier compliance included"
    },
    {
      "id": "visual-workflow-builder",
      "capability": "Visual workflow / orchestration builder (trigger, delay, branch)",
      "dimension": "developer-infra",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://docs.knock.app/",
            "https://docs.novu.co/",
            "https://www.courier.com/docs",
            "https://documentation.onesignal.com/docs",
            "https://www.magicbell.com/docs",
            "https://www.braze.com/docs/user_guide/messaging/canvas/create_a_canvas"
          ],
          "inferred": false
        }
      ],
      "seedISC": "Provide a visual, no-code builder for multi-step notification workflows"
    },
    {
      "id": "notification-grouping",
      "capability": "Notification grouping (thread/type clustering in the feed)",
      "dimension": "ux-surface",
      "tier": "T2",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 4,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications",
            "https://linear.app/docs/notifications",
            "https://help.figma.com/hc/en-us/articles/360041547813-Manage-email-notifications-for-comments-on-files",
            "https://slack.com/help/articles/360056534254-Manage-notifications-for-specific-channels-and-direct-messages"
          ],
          "inferred": false
        }
      ],
      "seedISC": "Cluster related notifications by thread or type in the feed"
    },
    {
      "id": "admin-notification-governance",
      "capability": "Org/workspace-admin notification defaults & enforcement",
      "dimension": "governance",
      "tier": "T2",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 4,
          "of": 8,
          "refs": [
            "https://support.atlassian.com/jira-cloud-administration/docs/configure-notification-schemes/",
            "https://slack.com/help/articles/214888418-Set-default-Do-Not-Disturb-hours",
            "https://www.notion.com/help/notification-settings",
            "https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications"
          ],
          "inferred": false
        }
      ],
      "seedISC": "Let an admin set org-wide notification defaults over individual users"
    },
    {
      "id": "real-time-delivery",
      "capability": "Real-time delivery (no polling delay)",
      "dimension": "delivery-control",
      "tier": "T2",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 4,
          "of": 8,
          "refs": [
            "https://linear.app/docs/notifications",
            "https://www.intercom.com/help/en/articles/187-how-teammates-get-notifications"
          ],
          "inferred": true,
          "note": "2 doc-confirmed refs + 2 table-inferred within the 4 count (skeptic F3)"
        },
        {
          "cohort": "inapp",
          "shipping": 2,
          "of": 8,
          "refs": [
            "https://slack.com/help/articles/360056534254-Manage-notifications-for-specific-channels-and-direct-messages",
            "https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications"
          ],
          "inferred": true
        }
      ],
      "seedISC": "Push notifications to the client the moment the event fires"
    },
    {
      "id": "deep-links-to-source",
      "capability": "Deep links from notification to source object",
      "dimension": "ux-surface",
      "tier": "T2",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 4,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/subscriptions-and-notifications/concepts/about-notifications",
            "https://linear.app/docs/inbox",
            "https://help.figma.com/hc/en-us/articles/360039813234-Manage-your-notification-preferences",
            "https://www.intercom.com/help/en/articles/187-how-teammates-get-notifications"
          ],
          "inferred": false
        }
      ],
      "seedISC": "Clicking a notification jumps directly to the underlying object"
    },
    {
      "id": "snooze-suppression",
      "capability": "Snooze (temporary, time-boxed suppression)",
      "dimension": "user-control",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 3,
          "of": 8,
          "refs": [
            "https://www.intercom.com/help/en/articles/187-how-teammates-get-notifications",
            "https://slack.com/help/articles/214888418-Set-default-Do-Not-Disturb-hours",
            "https://www.notion.com/help/reminders"
          ],
          "inferred": false
        }
      ],
      "seedISC": "Snooze a specific notification for a bounded, resumable period"
    },
    {
      "id": "dnd-quiet-hours",
      "capability": "DND / quiet-hours delivery window",
      "dimension": "delivery-control",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 2,
          "of": 8,
          "refs": [
            "https://slack.com/help/articles/214888418-Set-default-Do-Not-Disturb-hours",
            "https://help.asana.com/s/article/email-notifications?language=en_US"
          ],
          "inferred": false
        },
        {
          "cohort": "services",
          "shipping": 2,
          "of": 6,
          "refs": [
            "https://docs.knock.app/",
            "https://www.braze.com/docs/user_guide/messaging/messaging_fundamentals/quiet_hours"
          ],
          "inferred": false
        }
      ],
      "seedISC": "Honor a per-user quiet-hours window, holding delivery until it ends",
      "notes": "At-cutoff, encoded premium-notable: Slack default DND + Braze named Quiet Hours are landmark implementations (skeptic F6 — cutoff consistency)."
    },
    {
      "id": "chat-platform-routing",
      "capability": "Chat-platform notification routing (Slack/Teams/Discord/WhatsApp/LINE)",
      "dimension": "channel",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 3,
          "of": 8,
          "refs": [
            "https://linear.app/docs/notifications",
            "https://www.notion.com/help/notification-settings",
            "https://help.figma.com/hc/en-us/articles/360041547813-Manage-email-notifications-for-comments-on-files"
          ],
          "inferred": false
        },
        {
          "cohort": "services",
          "shipping": 5,
          "of": 6,
          "refs": [
            "https://docs.knock.app/",
            "https://docs.novu.co/",
            "https://www.courier.com/docs",
            "https://www.magicbell.com/docs",
            "https://www.braze.com/docs/user_guide/messaging/messaging_fundamentals/frequency_capping"
          ],
          "inferred": false
        }
      ],
      "seedISC": "Route notifications to a linked chat platform, not just email"
    },
    {
      "id": "admin-scheme-per-space",
      "capability": "Admin-configured notification scheme reusable per project/space",
      "dimension": "governance",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 1,
          "of": 8,
          "refs": [
            "https://support.atlassian.com/jira-cloud-administration/docs/configure-notification-schemes/"
          ],
          "inferred": false
        }
      ],
      "seedISC": "Let admins assign a reusable notification scheme to each space"
    },
    {
      "id": "dev-mode-notification-channel",
      "capability": "Role/mode-scoped notification channel (e.g., Dev Mode)",
      "dimension": "governance",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 1,
          "of": 8,
          "refs": [
            "https://help.figma.com/hc/en-us/articles/360039813234-Manage-your-notification-preferences"
          ],
          "inferred": false
        }
      ],
      "seedISC": "Scope a distinct notification channel to a paid or role-gated mode"
    },
    {
      "id": "side-conversation-notifications",
      "capability": "Side-conversation / internal-thread notification class",
      "dimension": "delivery-control",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 1,
          "of": 8,
          "refs": [
            "https://www.intercom.com/help/en/articles/187-how-teammates-get-notifications"
          ],
          "inferred": false
        }
      ],
      "seedISC": "Notify on internal side-thread replies as a distinct class"
    },
    {
      "id": "delivery-status-tracking",
      "capability": "Delivery status tracking (sent/delivered/opened/clicked)",
      "dimension": "developer-infra",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 5,
          "of": 6,
          "refs": [
            "https://docs.knock.app/",
            "https://docs.novu.co/",
            "https://www.courier.com/docs",
            "https://documentation.onesignal.com/docs",
            "https://www.magicbell.com/docs"
          ],
          "inferred": false
        }
      ],
      "seedISC": "Track per-message delivery, open, and click status through the pipeline"
    },
    {
      "id": "audience-segmentation-targeting",
      "capability": "Audience segmentation / dynamic targeting",
      "dimension": "developer-infra",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 5,
          "of": 6,
          "refs": [
            "https://docs.knock.app/",
            "https://docs.novu.co/",
            "https://www.courier.com/docs",
            "https://documentation.onesignal.com/docs",
            "https://www.braze.com/docs/user_guide/messaging/messaging_fundamentals/frequency_capping"
          ],
          "inferred": false
        }
      ],
      "seedISC": "Target a dynamic user segment rather than only individual recipients"
    },
    {
      "id": "frequency-capping",
      "capability": "Frequency capping (discrete per-user rule system, distinct from throttling)",
      "dimension": "reliability",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 1,
          "of": 6,
          "refs": [
            "https://www.braze.com/docs/user_guide/messaging/messaging_fundamentals/frequency_capping"
          ],
          "inferred": false
        }
      ],
      "seedISC": "Cap max sends per user per rolling window as a named rule"
    },
    {
      "id": "cross-channel-fallback-routing",
      "capability": "Cross-channel fallback routing (e.g., email to push to SMS on failure)",
      "dimension": "reliability",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 1,
          "of": 6,
          "refs": [
            "https://www.courier.com/docs/platform/sending/failover"
          ],
          "inferred": false
        }
      ],
      "seedISC": "Fail over to the next channel when the first delivery fails"
    },
    {
      "id": "account-workflow-audit-logs",
      "capability": "Account/workflow audit logs",
      "dimension": "governance",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 1,
          "of": 6,
          "refs": [
            "https://docs.knock.app/"
          ],
          "inferred": false
        }
      ],
      "seedISC": "Log every account and workflow-configuration action for later audit"
    },
    {
      "id": "self-hosted-deployment-option",
      "capability": "Self-hosted / open-source deployment option",
      "dimension": "developer-infra",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 1,
          "of": 6,
          "refs": [
            "https://docs.novu.co/"
          ],
          "inferred": false
        }
      ],
      "seedISC": "Offer a self-hosted deployment path, not only managed SaaS"
    }
  ],
  "antiCriteria": [
    {
      "id": "a-notification-storm",
      "rule": "Must not re-fire the same event repeatedly without dedup or a throttle/cap in place",
      "why": "Prevents notification-storm fatigue that trains users to ignore or globally mute the product; guards [mute-per-object], [digest-batched-delivery], [frequency-capping]"
    },
    {
      "id": "a-unsubscribable-email",
      "rule": "Must not send an email notification with no working unsubscribe or channel opt-out",
      "why": "Prevents un-unsubscribable email, a compliance and trust failure; guards [email-notification-channel], [per-channel-preference-matrix]"
    },
    {
      "id": "a-silent-pref-mismatch",
      "rule": "A preference toggle must apply on every channel it claims to cover; it must never silently fail to suppress one channel",
      "why": "Prevents preferences that appear to work but leak through a forgotten channel; guards [per-channel-preference-matrix], [per-event-topic-preferences]"
    },
    {
      "id": "a-stale-badge",
      "rule": "An unread badge must clear or decrement when the underlying item is read from any client, not just the one that read it",
      "why": "Prevents badge counts that never clear, a top user-visible defect; guards [unread-badge-count], [in-app-inbox]"
    },
    {
      "id": "a-self-notify",
      "rule": "Must not notify a user about an event they themselves just triggered",
      "why": "Prevents notifying the actor about their own action, a well-known annoyance pattern; guards [mention-privileged-class], [watch-subscribe-per-object]"
    },
    {
      "id": "a-bypass-mute",
      "rule": "A muted or unwatched object must not resurface through a side channel (digest, email summary) that ignores the mute state",
      "why": "Prevents mute from being cosmetic rather than authoritative; guards [mute-per-object], [digest-batched-delivery], [dnd-quiet-hours]"
    },
    {
      "id": "a-mention-silent-override",
      "rule": "If @mention delivery is privileged enough to bypass a user's DND/quiet-hours window, that bypass must be disclosed in the preference UI, never silent",
      "why": "Prevents a privileged notification class from covertly overriding a boundary the user believes they set; guards [mention-privileged-class], [dnd-quiet-hours]"
    },
    {
      "id": "a-invisible-admin-override",
      "rule": "When an org/admin-enforced scheme overrides a user's personal notification preference, the UI must show that an override is in effect",
      "why": "Prevents users from believing a preference is active when governance has silently overridden it; guards [admin-notification-governance], [admin-scheme-per-space]"
    },
    {
      "id": "a-digest-server-timezone",
      "rule": "Never compute digest or quiet-hours windows in server or UTC time",
      "why": "a 3am digest destroys trust — recipient-local timezone only; guards digest-batched-delivery and dnd-quiet-hours"
    }
  ],
  "sources": [
    "https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications",
    "https://docs.github.com/en/subscriptions-and-notifications/concepts/about-notifications",
    "https://slack.com/help/articles/360056534254-Manage-notifications-for-specific-channels-and-direct-messages",
    "https://slack.com/help/articles/214888418-Set-default-Do-Not-Disturb-hours",
    "https://linear.app/docs/notifications",
    "https://linear.app/docs/inbox",
    "https://www.notion.com/help/notification-settings",
    "https://www.notion.com/help/reminders",
    "https://help.asana.com/s/article/notification-settings",
    "https://help.asana.com/s/article/email-notifications?language=en_US",
    "https://help.figma.com/hc/en-us/articles/360039813234-Manage-your-notification-preferences",
    "https://help.figma.com/hc/en-us/articles/360041547813-Manage-email-notifications-for-comments-on-files",
    "https://www.intercom.com/help/en/articles/187-how-teammates-get-notifications",
    "https://www.intercom.com/help/en/articles/250-push-email-chat-and-post-notifications-for-customers",
    "https://support.atlassian.com/jira-software-cloud/docs/manage-your-jira-personal-settings/",
    "https://support.atlassian.com/jira-cloud-administration/docs/configure-notification-schemes/",
    "https://docs.knock.app/",
    "https://docs.novu.co/",
    "https://docs.novu.co/framework/digest",
    "https://docs.novu.co/platform/workflow/digest",
    "https://www.courier.com/docs",
    "https://www.courier.com/docs/platform/sending/failover",
    "https://www.courier.com/docs/platform/sending/",
    "https://www.courier.com/blog/eu-data-residency-notifications",
    "https://documentation.onesignal.com/docs",
    "https://documentation.onesignal.com/docs/throttling",
    "https://www.magicbell.com/docs",
    "https://www.magicbell.com/docs/notification-rendering/templates",
    "https://www.braze.com/docs/user_guide/messaging/messaging_fundamentals/frequency_capping",
    "https://www.braze.com/docs/user_guide/messaging/messaging_fundamentals/quiet_hours",
    "https://www.braze.com/docs/user_guide/messaging/canvas/create_a_canvas",
    "https://www.braze.com/docs/user_guide/messaging/canvas/faqs"
  ]
} as Archetype;

export default Notifications;
