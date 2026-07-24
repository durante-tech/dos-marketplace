import type { Archetype } from '../Schema/Archetype';

export const FeatureFlags: Archetype = {
  "name": "feature-flags",
  "title": "Feature Flags — Feature Archetype Completeness Matrix",
  "version": "0.1.0",
  "updated": "2026-07-22",
  "cohorts": [
    {
      "id": "inapp",
      "label": "Platforms with embedded feature-flag/remote-config surfaces (in-app cohort, n=8)",
      "references": [
        "GitLab",
        "PostHog",
        "Firebase Remote Config",
        "AWS AppConfig",
        "Azure App Configuration",
        "Vercel",
        "Harness FF",
        "Optimizely"
      ]
    },
    {
      "id": "services",
      "label": "Dedicated feature-flag vendors (services cohort, n=6)",
      "references": [
        "LaunchDarkly",
        "Flagsmith",
        "Unleash",
        "ConfigCat",
        "Split",
        "Statsig"
      ]
    }
  ],
  "tierDefinitions": {
    "T1": "Table stakes — shipped by >=6/8 of the in-app cohort (a partially-inferred count clears only on its confirmed portion), OR universal (6/6, doc-confirmed) across the dedicated services cohort regardless of in-app count. Absence reads as broken.",
    "T2": "Expected — 4-5/8 of the in-app cohort. Absence is a known limitation users notice.",
    "T3": "Differentiator — <=3/8 in-app (including 0-count and no-in-app-evidence rows unless the services override applies). Ships for advantage, defers without apology."
  },
  "rows": [
    {
      "id": "flag-crud",
      "capability": "Create, edit, delete flags",
      "dimension": "flag-management",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 8,
          "of": 8,
          "refs": [
            "https://docs.gitlab.com/ee/api/feature_flags.html",
            "https://posthog.com/docs/feature-flags/creating-feature-flags",
            "https://docs.aws.amazon.com/appconfig/latest/userguide/what-is-appconfig.html"
          ]
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://launchdarkly.com/",
            "https://flagsmith.com/",
            "https://configcat.com/"
          ]
        }
      ],
      "seedISC": "Flags can be created, edited, and deleted from the management surface"
    },
    {
      "id": "boolean-toggle",
      "capability": "Boolean on/off flags",
      "dimension": "flag-management",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 8,
          "of": 8,
          "refs": [
            "https://docs.developers.optimizely.com/feature-experimentation/docs"
          ]
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://launchdarkly.com/",
            "https://www.getunleash.io/"
          ]
        }
      ],
      "seedISC": "A flag toggles a code path on or off at runtime"
    },
    {
      "id": "multivariate-flags",
      "capability": "Multivariate flags (named variants)",
      "dimension": "flag-management",
      "tier": "T2",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 4,
          "of": 8,
          "refs": [
            "https://posthog.com/docs/feature-flags",
            "https://learn.microsoft.com/en-us/azure/azure-app-configuration/concept-feature-management",
            "https://docs.developers.optimizely.com/feature-experimentation/docs"
          ]
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "inferred": true,
          "confirmed": 2,
          "refs": [
            "https://launchdarkly.com/",
            "https://www.statsig.com/"
          ],
          "note": "LaunchDarkly + Statsig doc-quoted; others implicit via targeting + variants (miner caveat) — no T1 override on an inferred-majority count"
        }
      ],
      "seedISC": "Flags serve named variants beyond boolean on and off"
    },
    {
      "id": "json-config-payloads",
      "capability": "Structured config payloads on flags",
      "dimension": "flag-management",
      "tier": "T2",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 4,
          "of": 8,
          "refs": [
            "https://posthog.com/docs/feature-flags",
            "https://firebase.google.com/docs/remote-config",
            "https://vercel.com/docs/edge-config"
          ]
        },
        {
          "cohort": "services",
          "shipping": 5,
          "of": 6,
          "inferred": true,
          "confirmed": 3,
          "refs": [
            "https://flagsmith.com/",
            "https://www.statsig.com/",
            "https://configcat.com/"
          ],
          "note": "Flagsmith/Statsig/ConfigCat doc-quoted; LaunchDarkly + Unleash listed without direct quote"
        }
      ],
      "notes": "Roster caveats propagate: Firebase (remote-config framing) and Vercel (Edge Config general-purpose substrate) ground in-app cells here.",
      "seedISC": "Flags deliver structured configuration payloads to consuming code"
    },
    {
      "id": "flag-versioning-history",
      "capability": "Flag change versioning and history",
      "dimension": "flag-management",
      "tier": "T2",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 5,
          "of": 8,
          "refs": [
            "https://firebase.google.com/docs/remote-config",
            "https://learn.microsoft.com/en-us/azure/azure-app-configuration/",
            "https://docs.aws.amazon.com/appconfig/latest/userguide/what-is-appconfig.html"
          ],
          "note": "Miner additionally marked PostHog/Vercel/Optimizely inferred-positive outside the count"
        }
      ],
      "seedISC": "Every flag change is versioned with viewable history"
    },
    {
      "id": "environments-multiple",
      "capability": "Per-environment flag state",
      "dimension": "flag-management",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://flagsmith.com/",
            "https://configcat.com/pricing"
          ]
        }
      ],
      "notes": "T1 via the services universality override; in-app cohort scopes environments through permission scoping (see permission-scoping-environments).",
      "seedISC": "Flag state is scoped per environment with independent toggles"
    },
    {
      "id": "multi-project-scope",
      "capability": "Project/workspace organization for flags",
      "dimension": "flag-management",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 3,
          "of": 8,
          "refs": [
            "https://posthog.com/docs/feature-flags",
            "https://vercel.com/docs/edge-config"
          ],
          "inferred": true,
          "confirmed": 2,
          "note": "Firebase cell inferred (cross-project)"
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "inferred": true,
          "confirmed": 5,
          "refs": [
            "https://www.getunleash.io/",
            "https://configcat.com/"
          ],
          "note": "Harness org/workspace structure counted indirectly (roster caveat: Split->Harness transition) — confirmed 5 of 6, override refused"
        }
      ],
      "seedISC": "Flags organize under projects or workspaces with independent membership"
    },
    {
      "id": "percentage-rollout",
      "capability": "Percentage rollout of a flag",
      "dimension": "targeting-rollout",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 8,
          "of": 8,
          "inferred": true,
          "confirmed": 7,
          "refs": [
            "https://docs.gitlab.com/ee/operations/feature_flags.html",
            "https://posthog.com/docs/feature-flags/creating-feature-flags",
            "https://learn.microsoft.com/en-us/azure/azure-app-configuration/concept-feature-management"
          ],
          "note": "Harness cell inferred (roster caveat: module scope); confirmed 7 clears the T1 band"
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://configcat.com/",
            "https://www.getunleash.io/"
          ]
        }
      ],
      "seedISC": "A flag serves to a configurable percentage of users"
    },
    {
      "id": "targeting-rules",
      "capability": "Identity/attribute targeting rules",
      "dimension": "targeting-rollout",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 7,
          "of": 8,
          "refs": [
            "https://docs.gitlab.com/ee/operations/feature_flags.html",
            "https://posthog.com/docs/feature-flags",
            "https://developer.harness.io/docs/feature-flags"
          ]
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://configcat.com/",
            "https://www.statsig.com/"
          ]
        }
      ],
      "notes": "Covers direct user lists and attribute-rule conditions; property-override variants ledgered as naming variants.",
      "seedISC": "Targeting rules gate flags on user identity and attributes"
    },
    {
      "id": "segment-cohorts",
      "capability": "Reusable segments/cohorts for targeting",
      "dimension": "targeting-rollout",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 4,
          "of": 8,
          "inferred": true,
          "confirmed": 3,
          "refs": [
            "https://posthog.com/docs/feature-flags",
            "https://firebase.google.com/docs/remote-config",
            "https://docs.developers.optimizely.com/feature-experimentation/docs"
          ],
          "note": "Azure cell inferred"
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://configcat.com/",
            "https://www.statsig.com/"
          ]
        }
      ],
      "notes": "T1 via the services universality override (6/6 doc-confirmed).",
      "seedISC": "Reusable segments target flags across multiple rules consistently"
    },
    {
      "id": "geo-targeting",
      "capability": "Geographic targeting",
      "dimension": "targeting-rollout",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 3,
          "of": 8,
          "refs": [
            "https://posthog.com/docs/feature-flags/creating-feature-flags",
            "https://learn.microsoft.com/en-us/azure/azure-app-configuration/concept-feature-management"
          ]
        }
      ],
      "seedISC": "Targeting rules can match on user geographic location"
    },
    {
      "id": "device-platform-targeting",
      "capability": "Device/browser/platform targeting",
      "dimension": "targeting-rollout",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 3,
          "of": 8,
          "refs": [
            "https://posthog.com/docs/feature-flags/creating-feature-flags",
            "https://learn.microsoft.com/en-us/azure/azure-app-configuration/concept-feature-management",
            "https://firebase.google.com/docs/remote-config"
          ]
        }
      ],
      "seedISC": "Targeting rules can match device, browser, or platform"
    },
    {
      "id": "scheduled-changes",
      "capability": "Scheduled flag changes",
      "dimension": "targeting-rollout",
      "tier": "T2",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 4,
          "of": 8,
          "inferred": true,
          "confirmed": 3,
          "refs": [
            "https://posthog.com/docs/feature-flags",
            "https://learn.microsoft.com/en-us/azure/azure-app-configuration/concept-feature-management",
            "https://docs.developers.optimizely.com/feature-experimentation/docs"
          ],
          "note": "Firebase cell inferred"
        },
        {
          "cohort": "services",
          "shipping": 3,
          "of": 6,
          "refs": [
            "https://launchdarkly.com/",
            "https://www.statsig.com/"
          ]
        }
      ],
      "seedISC": "Flag changes can be scheduled for a future time"
    },
    {
      "id": "staged-progression",
      "capability": "Staged/progressive rollout sequences",
      "dimension": "targeting-rollout",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://launchdarkly.com/",
            "https://www.getunleash.io/",
            "https://www.statsig.com/"
          ]
        }
      ],
      "notes": "T1 via the services universality override (6/6 doc-confirmed). In-app cohort folds staged progression into its percentage/gradual line — no distinct in-app grounding exists, so no in-app count is carried (Step 4b arithmetic fix: counts come from table lines only).",
      "seedISC": "Rollouts progress through defined stages toward full exposure"
    },
    {
      "id": "kill-switch",
      "capability": "Instant kill switch",
      "dimension": "targeting-rollout",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 7,
          "of": 8,
          "refs": [
            "https://docs.aws.amazon.com/appconfig/latest/userguide/what-is-appconfig.html",
            "https://learn.microsoft.com/en-us/azure/azure-app-configuration/concept-feature-management",
            "https://developer.harness.io/docs/feature-flags"
          ]
        },
        {
          "cohort": "services",
          "shipping": 4,
          "of": 6,
          "inferred": true,
          "confirmed": 2,
          "refs": [
            "https://www.getunleash.io/",
            "https://www.statsig.com/"
          ],
          "note": "Unleash + Statsig doc-quoted; LaunchDarkly/Flagsmith inferred"
        }
      ],
      "seedISC": "Any flag disables instantly without deployment or restart"
    },
    {
      "id": "rollback-prior-state",
      "capability": "Revert flag to prior configuration",
      "dimension": "targeting-rollout",
      "tier": "T2",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 6,
          "of": 8,
          "inferred": true,
          "confirmed": 5,
          "refs": [
            "https://firebase.google.com/docs/remote-config",
            "https://docs.aws.amazon.com/appconfig/latest/userguide/what-is-appconfig.html",
            "https://docs.developers.optimizely.com/feature-experimentation/docs"
          ],
          "note": "GitLab cell inferred; confirmed 5 does not clear the T1 band (gen-38 confirmed-clearance law)"
        }
      ],
      "seedISC": "Flag configuration reverts to a prior recorded state"
    },
    {
      "id": "flag-dependencies",
      "capability": "Flag prerequisites/dependencies",
      "dimension": "targeting-rollout",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 3,
          "of": 8,
          "inferred": true,
          "confirmed": 2,
          "refs": [
            "https://posthog.com/docs/feature-flags",
            "https://developer.harness.io/docs/feature-flags"
          ],
          "note": "Optimizely cell inferred"
        },
        {
          "cohort": "services",
          "shipping": 2,
          "of": 6,
          "refs": [
            "https://www.statsig.com/",
            "https://launchdarkly.com/"
          ],
          "inferred": true,
          "confirmed": 1,
          "note": "LaunchDarkly cell inferred (prerequisites)"
        }
      ],
      "seedISC": "A flag can require prerequisite flags before evaluating true"
    },
    {
      "id": "anonymous-consistent-bucketing",
      "capability": "Stable assignment for anonymous users",
      "dimension": "targeting-rollout",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 2,
          "of": 8,
          "refs": [
            "https://posthog.com/docs/feature-flags/creating-feature-flags",
            "https://docs.developers.optimizely.com/feature-experimentation/docs"
          ]
        }
      ],
      "seedISC": "Anonymous users receive stable flag assignments across sessions"
    },
    {
      "id": "early-access-beta",
      "capability": "Beta/early-access enrollment",
      "dimension": "targeting-rollout",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 2,
          "of": 8,
          "refs": [
            "https://posthog.com/docs/feature-flags",
            "https://docs.developers.optimizely.com/feature-experimentation/docs"
          ]
        }
      ],
      "seedISC": "Users can opt into beta features through managed enrollment"
    },
    {
      "id": "auto-rollback-on-alarm",
      "capability": "Automatic rollback on health alarm",
      "dimension": "targeting-rollout",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 1,
          "of": 8,
          "refs": [
            "https://docs.aws.amazon.com/appconfig/latest/userguide/what-is-appconfig.html"
          ]
        }
      ],
      "notes": "Premium-notable below-cutoff row (explicit AWS AppConfig differentiator).",
      "seedISC": "Rollouts revert automatically when monitored health alarms fire"
    },
    {
      "id": "rest-api",
      "capability": "Management REST/HTTP API",
      "dimension": "delivery-evaluation",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 8,
          "of": 8,
          "inferred": true,
          "confirmed": 6,
          "refs": [
            "https://docs.gitlab.com/ee/api/feature_flags.html",
            "https://vercel.com/docs/edge-config",
            "https://learn.microsoft.com/en-us/azure/azure-app-configuration/"
          ],
          "note": "Harness + Optimizely cells inferred; confirmed 6 clears the T1 band"
        }
      ],
      "seedISC": "Flags are manageable programmatically through an HTTP API"
    },
    {
      "id": "client-sdks",
      "capability": "Client-side SDKs",
      "dimension": "delivery-evaluation",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 7,
          "of": 8,
          "refs": [
            "https://posthog.com/docs/feature-flags",
            "https://firebase.google.com/docs/remote-config",
            "https://learn.microsoft.com/en-us/azure/azure-app-configuration/"
          ]
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://configcat.com/",
            "https://www.statsig.com/"
          ]
        }
      ],
      "seedISC": "Client applications evaluate flags through an official SDK"
    },
    {
      "id": "server-sdks",
      "capability": "Server-side SDKs",
      "dimension": "delivery-evaluation",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 6,
          "of": 8,
          "refs": [
            "https://posthog.com/docs/feature-flags",
            "https://firebase.google.com/docs/remote-config",
            "https://developer.harness.io/docs/feature-flags"
          ]
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://www.statsig.com/",
            "https://launchdarkly.com/"
          ]
        }
      ],
      "seedISC": "Server runtimes evaluate flags through an official SDK"
    },
    {
      "id": "local-evaluation",
      "capability": "Local/low-latency flag evaluation",
      "dimension": "delivery-evaluation",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 6,
          "of": 8,
          "inferred": true,
          "confirmed": 5,
          "refs": [
            "https://posthog.com/docs/feature-flags",
            "https://vercel.com/docs/edge-config",
            "https://docs.aws.amazon.com/appconfig/latest/userguide/what-is-appconfig.html"
          ],
          "note": "Harness cell inferred"
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://www.statsig.com/",
            "https://configcat.com/"
          ]
        }
      ],
      "notes": "T1 via the services universality override (all six SDK families cache/evaluate locally). Roster caveat: ConfigCat client-side-evaluation bias grounds a services cell.",
      "seedISC": "Flag evaluation completes locally without a per-check network call"
    },
    {
      "id": "streaming-updates",
      "capability": "Streaming/real-time flag updates",
      "dimension": "delivery-evaluation",
      "tier": "T2",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 4,
          "of": 8,
          "inferred": true,
          "confirmed": 2,
          "refs": [
            "https://firebase.google.com/docs/remote-config",
            "https://docs.developers.optimizely.com/feature-experimentation/docs"
          ],
          "note": "PostHog + Vercel cells inferred"
        },
        {
          "cohort": "services",
          "shipping": 2,
          "of": 6,
          "refs": [
            "https://www.getunleash.io/",
            "https://www.statsig.com/"
          ]
        }
      ],
      "seedISC": "Flag changes propagate to connected clients in near real-time"
    },
    {
      "id": "client-bootstrapping",
      "capability": "Startup flag bootstrapping",
      "dimension": "delivery-evaluation",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 3,
          "of": 8,
          "inferred": true,
          "confirmed": 2,
          "refs": [
            "https://posthog.com/docs/feature-flags",
            "https://docs.developers.optimizely.com/feature-experimentation/docs"
          ],
          "note": "Firebase cell inferred"
        }
      ],
      "seedISC": "Initial flag values are available at application startup"
    },
    {
      "id": "edge-evaluation",
      "capability": "Edge/CDN flag evaluation",
      "dimension": "delivery-evaluation",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 1,
          "of": 8,
          "refs": [
            "https://vercel.com/docs/edge-config"
          ]
        }
      ],
      "notes": "Premium-notable below-cutoff row (explicit Vercel differentiator; roster caveat: Edge Config substrate broader than flags).",
      "seedISC": "Flags evaluate at edge locations close to users",
      "contextRider": "edge-deployed",
      "riderRationale": "Within edge-deployed topologies evaluation-at-edge is the differentiating capability (Vercel explicit)"
    },
    {
      "id": "relay-proxy",
      "capability": "Relay/proxy for private networks",
      "dimension": "delivery-evaluation",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 4,
          "of": 6,
          "inferred": true,
          "confirmed": 3,
          "refs": [
            "https://www.getunleash.io/",
            "https://configcat.com/",
            "https://launchdarkly.com/pricing/"
          ],
          "note": "Statsig cell inferred (warehouse-native positioning, roster caveat)"
        }
      ],
      "seedISC": "A relay or proxy serves flags inside private networks",
      "contextRider": "private-network",
      "riderRationale": "Within private-network deployments the relay is the standard serving shape (services 4/6 confirmed 3)"
    },
    {
      "id": "caching-ttl",
      "capability": "Local caching with controlled refresh",
      "dimension": "delivery-evaluation",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 3,
          "of": 8,
          "inferred": true,
          "confirmed": 2,
          "refs": [
            "https://firebase.google.com/docs/remote-config",
            "https://docs.aws.amazon.com/appconfig/latest/userguide/what-is-appconfig.html"
          ],
          "note": "Vercel cell inferred"
        }
      ],
      "seedISC": "Flag values cache locally with a controlled refresh interval"
    },
    {
      "id": "validators-preflight",
      "capability": "Pre-deployment configuration validation",
      "dimension": "delivery-evaluation",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 2,
          "of": 8,
          "inferred": true,
          "confirmed": 1,
          "refs": [
            "https://docs.aws.amazon.com/appconfig/latest/userguide/what-is-appconfig.html"
          ],
          "note": "Azure cell inferred"
        }
      ],
      "seedISC": "Configuration changes validate syntactically and semantically before deployment"
    },
    {
      "id": "rbac",
      "capability": "Role-based access control for flags",
      "dimension": "governance-operations",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 5,
          "of": 8,
          "inferred": true,
          "confirmed": 4,
          "refs": [
            "https://docs.gitlab.com/ee/api/feature_flags.html",
            "https://developer.harness.io/docs/feature-flags",
            "https://docs.developers.optimizely.com/feature-experimentation/docs"
          ],
          "note": "Azure cell inferred"
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://docs.flagsmith.com/system-administration/rbac",
            "https://www.getunleash.io/pricing",
            "https://configcat.com/"
          ]
        }
      ],
      "notes": "T1 via the services universality override (6/6 doc-confirmed).",
      "seedISC": "Flag management actions are gated by user roles"
    },
    {
      "id": "custom-roles",
      "capability": "Custom role definitions",
      "dimension": "governance-operations",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 4,
          "of": 6,
          "inferred": true,
          "confirmed": 3,
          "refs": [
            "https://docs.flagsmith.com/system-administration/rbac",
            "https://www.getunleash.io/pricing",
            "https://configcat.com/"
          ],
          "note": "Statsig cell inferred; Harness essentials-tier limit noted (roster caveat: Split->Harness)"
        }
      ],
      "seedISC": "Administrators define custom roles with granular flag permissions"
    },
    {
      "id": "approval-workflows",
      "capability": "Change approval workflows",
      "dimension": "governance-operations",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 3,
          "of": 8,
          "inferred": true,
          "confirmed": 2,
          "refs": [
            "https://developer.harness.io/docs/feature-flags",
            "https://docs.developers.optimizely.com/feature-experimentation/docs"
          ],
          "note": "Azure cell inferred"
        },
        {
          "cohort": "services",
          "shipping": 4,
          "of": 6,
          "refs": [
            "https://launchdarkly.com/platform/access-governance/",
            "https://www.getunleash.io/pricing"
          ]
        }
      ],
      "seedISC": "Flag changes can require review and approval before applying"
    },
    {
      "id": "flag-audit-trail",
      "capability": "Audit trail of flag changes",
      "dimension": "governance-operations",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 4,
          "of": 8,
          "refs": [
            "https://docs.gitlab.com/ee/operations/feature_flags.html",
            "https://docs.aws.amazon.com/appconfig/latest/userguide/what-is-appconfig.html",
            "https://developer.harness.io/docs/feature-flags"
          ],
          "inferred": true,
          "confirmed": 3,
          "note": "Azure cell inferred (diagnostic logs)"
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://www.getunleash.io/pricing",
            "https://launchdarkly.com/pricing/",
            "https://configcat.com/"
          ]
        }
      ],
      "notes": "T1 via the services universality override. Boundary: audit OF flag changes is in-domain; the product's general audit log belongs to the audit-log archetype. Retention depth is plan-tier metadata (ledgered).",
      "seedISC": "Every flag change records actor, timestamp, and difference"
    },
    {
      "id": "permission-scoping-environments",
      "capability": "Per-project/per-environment permission scoping",
      "dimension": "governance-operations",
      "tier": "T2",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 6,
          "of": 8,
          "inferred": true,
          "confirmed": 5,
          "refs": [
            "https://docs.gitlab.com/ee/operations/feature_flags.html",
            "https://vercel.com/docs/edge-config",
            "https://docs.developers.optimizely.com/feature-experimentation/docs"
          ],
          "note": "Harness cell inferred; confirmed 5 does not clear the T1 band (gen-38)"
        }
      ],
      "seedISC": "Permissions scope independently per project and per environment"
    },
    {
      "id": "git-iac-management",
      "capability": "Git/IaC-based flag management",
      "dimension": "governance-operations",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 3,
          "of": 8,
          "inferred": true,
          "confirmed": 2,
          "refs": [
            "https://developer.harness.io/docs/feature-flags",
            "https://learn.microsoft.com/en-us/azure/azure-app-configuration/"
          ],
          "note": "GitLab cell inferred"
        },
        {
          "cohort": "services",
          "shipping": 2,
          "of": 6,
          "refs": [
            "https://docs.flagsmith.com/",
            "https://configcat.com/docs/"
          ],
          "inferred": true,
          "confirmed": 1,
          "note": "ConfigCat cell implied-via-API (treated as inferred)"
        }
      ],
      "seedISC": "Flags are manageable through version-controlled configuration files"
    },
    {
      "id": "jira-issue-linking",
      "capability": "Issue-tracker flag linking",
      "dimension": "governance-operations",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 2,
          "of": 8,
          "refs": [
            "https://docs.gitlab.com/ee/operations/feature_flags.html",
            "https://developer.harness.io/docs/feature-flags"
          ]
        }
      ],
      "seedISC": "Flags link to tracked issues for lifecycle traceability"
    },
    {
      "id": "webhooks-flag-events",
      "capability": "Webhooks on flag change events",
      "dimension": "governance-operations",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 2,
          "of": 8,
          "refs": [
            "https://developer.harness.io/docs/feature-flags",
            "https://docs.developers.optimizely.com/feature-experimentation/docs"
          ]
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://docs.flagsmith.com/integrations/",
            "https://www.getunleash.io/",
            "https://configcat.com/"
          ]
        }
      ],
      "notes": "T1 via the services universality override — flag-change eventing is universal among dedicated vendors despite thin in-app presence. Native chat integrations ledgered to notifications turf.",
      "seedISC": "Flag change events deliver to registered external webhooks"
    },
    {
      "id": "code-references-detection",
      "capability": "Code references / stale-flag detection",
      "dimension": "governance-operations",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 1,
          "of": 8,
          "refs": [
            "https://docs.gitlab.com/ee/operations/feature_flags.html"
          ]
        },
        {
          "cohort": "services",
          "shipping": 2,
          "of": 6,
          "refs": [
            "https://configcat.com/",
            "https://docs.getunleash.io/"
          ]
        }
      ],
      "notes": "Premium-notable (GitLab Premium/Ultimate pay-gate; ConfigCat/Unleash differentiator).",
      "seedISC": "Stale flags surface through code reference detection"
    },
    {
      "id": "ab-testing",
      "capability": "A/B testing on flag variants",
      "dimension": "experimentation",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 5,
          "of": 8,
          "inferred": true,
          "confirmed": 4,
          "refs": [
            "https://firebase.google.com/docs/remote-config",
            "https://docs.aws.amazon.com/appconfig/latest/userguide/what-is-appconfig.html",
            "https://vercel.com/docs/edge-config"
          ],
          "note": "PostHog cell implicit-via-variants (inferred)"
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://www.statsig.com/",
            "https://launchdarkly.com/platform/experimentation/",
            "https://configcat.com/"
          ]
        }
      ],
      "notes": "T1 via the services universality override. Boundary: variant assignment + outcome comparison at flag altitude is in-domain; the full experimentation platform is adjacent turf (ledgered).",
      "seedISC": "Flag variants split traffic for controlled outcome comparison"
    },
    {
      "id": "multi-armed-bandit",
      "capability": "Multi-armed bandit optimization",
      "dimension": "experimentation",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 1,
          "of": 8,
          "refs": [
            "https://docs.developers.optimizely.com/feature-experimentation/docs"
          ]
        },
        {
          "cohort": "services",
          "shipping": 2,
          "of": 6,
          "refs": [
            "https://launchdarkly.com/platform/experimentation/",
            "https://www.statsig.com/"
          ]
        }
      ],
      "seedISC": "Traffic shifts automatically toward better performing variants"
    },
    {
      "id": "holdout-groups",
      "capability": "Holdout/control groups",
      "dimension": "experimentation",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 2,
          "of": 8,
          "refs": [
            "https://firebase.google.com/docs/remote-config",
            "https://docs.developers.optimizely.com/feature-experimentation/docs"
          ]
        },
        {
          "cohort": "services",
          "shipping": 2,
          "of": 6,
          "refs": [
            "https://launchdarkly.com/platform/experimentation/",
            "https://www.statsig.com/"
          ]
        }
      ],
      "seedISC": "Holdout groups measure aggregate impact against a baseline"
    },
    {
      "id": "statistical-results",
      "capability": "Statistical experiment analysis",
      "dimension": "experimentation",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 3,
          "of": 8,
          "refs": [
            "https://firebase.google.com/docs/remote-config",
            "https://docs.aws.amazon.com/appconfig/latest/userguide/what-is-appconfig.html",
            "https://docs.developers.optimizely.com/feature-experimentation/docs"
          ]
        }
      ],
      "seedISC": "Experiment results report statistical significance per variant"
    },
    {
      "id": "exposure-event-tracking",
      "capability": "Flag exposure event tracking",
      "dimension": "experimentation",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 3,
          "of": 8,
          "refs": [
            "https://posthog.com/docs/feature-flags",
            "https://firebase.google.com/docs/remote-config",
            "https://docs.developers.optimizely.com/feature-experimentation/docs"
          ]
        }
      ],
      "seedISC": "Flag exposures record as events for downstream analysis"
    },
    {
      "id": "warehouse-export",
      "capability": "Data export to warehouses",
      "dimension": "experimentation",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 1,
          "of": 8,
          "refs": [
            "https://docs.developers.optimizely.com/feature-experimentation/docs"
          ]
        },
        {
          "cohort": "services",
          "shipping": 2,
          "of": 6,
          "refs": [
            "https://launchdarkly.com/platform/experimentation/",
            "https://www.statsig.com/"
          ]
        }
      ],
      "seedISC": "Flag and experiment data export to external warehouses"
    },
    {
      "id": "cicd-pipeline-integration",
      "capability": "CI/CD pipeline integration",
      "dimension": "governance-operations",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 3,
          "of": 8,
          "inferred": true,
          "confirmed": 2,
          "refs": [
            "https://docs.aws.amazon.com/appconfig/latest/userguide/what-is-appconfig.html",
            "https://developer.harness.io/docs/feature-flags"
          ],
          "note": "GitLab cell inferred (implicit via Unleash)"
        }
      ],
      "seedISC": "Flag operations integrate into deployment pipelines as steps",
      "notes": "Added at Step 4b (skeptic silent-absence catch — the one unaccounted miner line)."
    }
  ],
  "antiCriteria": [
    {
      "id": "a-redeploy-to-toggle",
      "rule": "Flag state changes must NOT require an application deploy or restart to take effect",
      "why": "Runtime control is the category's founding purpose — flag CRUD at runtime is universal in both cohorts (flag-crud row, 8/8 + 6/6); a deploy-coupled flag is a config constant wearing a flag's name (kill-switch row guards the urgent case)"
    },
    {
      "id": "a-server-config-to-client",
      "rule": "Client-side evaluation must NOT receive server-only flag configurations or secret payloads",
      "why": "Client payloads are inspectable — ConfigCat's client-evaluation design and PostHog's local-evaluation docs separate client-safe from server-only surfaces (client-sdks, json-config-payloads rows); leaking server config to clients exposes unreleased features and secrets"
    },
    {
      "id": "a-hard-dependency-on-flag-service",
      "rule": "Request paths must NOT block or crash when the flag service is unreachable",
      "why": "Local evaluation with cached values is universal among dedicated vendors precisely as the failure posture (local-evaluation 6/6, caching-ttl rows); a hard dependency turns the safety tool into an outage amplifier"
    },
    {
      "id": "a-nonsticky-bucketing",
      "rule": "Percentage rollouts must NOT rebucket the same user across evaluations",
      "why": "Consistent bucketing is the documented contract (Optimizely consistent-bucketing across platforms; PostHog device-ID assignment — percentage-rollout, anonymous-consistent-bucketing rows); rebucketing users mid-rollout corrupts both UX and experiment reads"
    },
    {
      "id": "a-unaudited-flag-changes",
      "rule": "Flag state changes must NOT be applied without an attributable audit record",
      "why": "Flag-change audit is universal among dedicated vendors (flag-audit-trail row, services 6/6); an unaudited kill-switch or rollout change is undiagnosable in incident review"
    },
    {
      "id": "a-eval-without-default",
      "rule": "Flag evaluation must NOT throw or return null on unknown, mistyped, or malformed flags — the caller-supplied default serves",
      "why": "A typo'd key or type-mismatched payload crashing the request path defeats the safety tool; typed variants and payloads (multivariate-flags, json-config-payloads rows) make the mismatch case live, and the cached-fallback posture (local-evaluation row) extends to eval-time faults"
    }
  ],
  "sources": [
    "https://docs.gitlab.com/ee/operations/feature_flags.html",
    "https://docs.gitlab.com/ee/api/feature_flags.html",
    "https://posthog.com/docs/feature-flags",
    "https://posthog.com/docs/feature-flags/creating-feature-flags",
    "https://firebase.google.com/docs/remote-config",
    "https://firebase.google.com/docs/remote-config/get-started",
    "https://docs.aws.amazon.com/appconfig/",
    "https://docs.aws.amazon.com/appconfig/latest/userguide/what-is-appconfig.html",
    "https://learn.microsoft.com/en-us/azure/azure-app-configuration/",
    "https://learn.microsoft.com/en-us/azure/azure-app-configuration/concept-feature-management",
    "https://vercel.com/docs/edge-config",
    "https://developer.harness.io/docs/feature-flags",
    "https://docs.developers.optimizely.com/feature-experimentation/docs",
    "https://launchdarkly.com/",
    "https://launchdarkly.com/platform/feature-management/",
    "https://launchdarkly.com/platform/access-governance/",
    "https://launchdarkly.com/platform/integrations/",
    "https://launchdarkly.com/platform/experimentation/",
    "https://launchdarkly.com/pricing/",
    "https://flagsmith.com/",
    "https://docs.flagsmith.com/",
    "https://docs.flagsmith.com/system-administration/rbac",
    "https://docs.flagsmith.com/integrations/",
    "https://www.getunleash.io/",
    "https://www.getunleash.io/pricing",
    "https://docs.getunleash.io/",
    "https://configcat.com/",
    "https://configcat.com/docs/",
    "https://configcat.com/pricing",
    "https://www.split.io/",
    "https://www.harness.io/pricing",
    "https://www.statsig.com/",
    "https://docs.statsig.com/",
    "https://www.statsig.com/pricing"
  ]
};

export default FeatureFlags;
