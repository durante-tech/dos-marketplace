/**
 * Auth & Session Management archetype — 3rd corpus member, Stage-1
 * falsification battery (operator writ 2026-07-09). Two live-doc cohorts
 * mined 2026-07-09; full gen-22 recipe law; adversarial skeptic pass per
 * Step 4b (5 findings, ALL applied: cutoff-consistency note, session-triple
 * shared-source annotation, inferred-trio declared exceptions, 2 skeptic-
 * demanded anti-criteria). Field record: archer/MUTATIONS/field-mint-auth-session.md.
 */
import type { Archetype } from '../Schema/Archetype';

const AuthSession: Archetype = {
  "name": "auth-session",
  "title": "Auth & Session Management",
  "version": "0.1.1",
  "updated": "2026-07-10",
  "cohorts": [
    {
      "id": "inapp",
      "label": "In-app account-security surfaces (sets user expectations)",
      "references": [
        "GitHub",
        "Slack",
        "Notion",
        "Linear",
        "Figma",
        "Vercel",
        "Shopify",
        "Atlassian"
      ]
    },
    {
      "id": "services",
      "label": "Dedicated auth platforms (API-tier norms; universal here forces T1)",
      "references": [
        "Auth0",
        "Clerk",
        "WorkOS",
        "Firebase Authentication",
        "Stytch",
        "Kinde"
      ]
    }
  ],
  "tierDefinitions": {
    "T1": "Table-stakes: essentially all in-app references ship it (>=6/8), OR it is universal across the auth-services cohort — that override is unconditional and applies even when in-app coverage is low (in-app UIs hide backend capabilities; demoting a universal capability requires a groundingException). Absence reads as broken/unfinished. MUST be built or deferred-with-ledger-row; silent absence is the failure.",
    "T2": "Expected: majority of in-app references (4-5/8). Absence is a known limitation users ask about within weeks. Deferral needs a one-line reason.",
    "T3": "Delighter: rare or absent among market references (<=3/8 in-app, including 0 and rows with no in-app evidence at all, unless the universality override applies). Optional; building one while T1 rows are silent-absent is the anti-pattern. (A declared groundingException in the row data — never inferred by a reviewer — is the only other path to T1.)"
  },
  "rows": [
    {
      "id": "password-auth",
      "capability": "Password authentication",
      "dimension": "Sign-In",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 6,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/authentication",
            "https://slack.com/help/articles/204509068-Two-factor-authentication-2FA-for-Slack",
            "https://www.notion.com/help/two-step-verification",
            "https://help.figma.com/hc/en-us/articles/360039817634-Enable-two-factor-authentication-2FA",
            "https://vercel.com/docs/security",
            "https://help.shopify.com/en/manual/your-account/manage-account/two-step-authentication",
            "https://support.atlassian.com/security-and-access-policies/docs/authentication-policy-settings-for-your-organizations/"
          ]
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://auth0.com/docs/authenticate",
            "https://clerk.com/docs",
            "https://workos.com/docs/user-management",
            "https://firebase.google.com/docs/auth",
            "https://stytch.com/docs",
            "https://docs.kinde.com/"
          ]
        }
      ],
      "seedISC": "Users can sign in with an email and password"
    },
    {
      "id": "social-oauth-signin",
      "capability": "Social OAuth sign-in (Google/Microsoft/etc.)",
      "dimension": "Sign-In",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 5,
          "of": 8,
          "refs": [
            "https://www.notion.com/help/saml-sso-configuration",
            "https://linear.app/docs/login-methods",
            "https://help.figma.com/hc/en-us/articles/360052497994-Set-login-and-authentication-method",
            "https://support.atlassian.com/security-and-access-policies/docs/authentication-policy-settings-for-your-organizations/",
            "https://vercel.com/docs/security"
          ],
          "inferred": true
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://auth0.com/docs/authenticate",
            "https://clerk.com/docs",
            "https://workos.com/docs/sso",
            "https://firebase.google.com/docs/auth",
            "https://stytch.com/docs",
            "https://docs.kinde.com/"
          ]
        }
      ],
      "seedISC": "Users can sign in via Google, GitHub, or Microsoft OAuth"
    },
    {
      "id": "magic-link-signin",
      "capability": "Magic link / email-code sign-in",
      "dimension": "Sign-In",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 3,
          "of": 8,
          "refs": [
            "https://www.notion.com/help/two-step-verification",
            "https://linear.app/docs/login-methods",
            "https://slack.com/help/articles/204509068-Two-factor-authentication-2FA-for-Slack"
          ],
          "inferred": true
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://auth0.com/docs/authenticate",
            "https://clerk.com/docs",
            "https://workos.com/docs/user-management",
            "https://firebase.google.com/docs/auth",
            "https://stytch.com/docs",
            "https://docs.kinde.com/"
          ],
          "inferred": true,
          "confirmed": 5
        }
      ],
      "seedISC": "Users can sign in via a passwordless emailed magic link",
      "groundingException": "services 6/6 with Firebase email-link inferred (standard documented feature, not re-fetched this pass) — 5/6 doc-quoted"
    },
    {
      "id": "passkey-signin",
      "capability": "Passkey / WebAuthn passwordless sign-in",
      "dimension": "Sign-In",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 3,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/authentication",
            "https://linear.app/docs/login-methods",
            "https://vercel.com/docs/security"
          ]
        },
        {
          "cohort": "services",
          "shipping": 5,
          "of": 6,
          "refs": [
            "https://auth0.com/docs/authenticate",
            "https://clerk.com/docs",
            "https://workos.com/docs/user-management",
            "https://stytch.com/docs",
            "https://docs.kinde.com/"
          ],
          "inferred": true
        }
      ],
      "seedISC": "Users can register and sign in using a passkey"
    },
    {
      "id": "phone-primary-signin",
      "capability": "Phone number as primary sign-in identifier",
      "dimension": "Sign-In",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 4,
          "of": 6,
          "refs": [
            "https://auth0.com/docs/secure/multi-factor-authentication",
            "https://clerk.com/docs",
            "https://firebase.google.com/docs/auth",
            "https://stytch.com/docs"
          ]
        }
      ],
      "seedISC": "Users can sign in using phone number as primary identifier"
    },
    {
      "id": "account-linking",
      "capability": "Account linking (merge multiple providers into one identity)",
      "dimension": "Sign-In",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 4,
          "of": 6,
          "refs": [
            "https://auth0.com/docs/authenticate",
            "https://firebase.google.com/docs/auth/web/account-linking",
            "https://clerk.com/docs",
            "https://stytch.com/docs"
          ],
          "inferred": true
        }
      ],
      "seedISC": "Users can link multiple sign-in providers into one account"
    },
    {
      "id": "totp-mfa",
      "capability": "TOTP authenticator-app 2FA",
      "dimension": "MFA",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 8,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/authentication",
            "https://slack.com/help/articles/204509068-Two-factor-authentication-2FA-for-Slack",
            "https://www.notion.com/help/two-step-verification",
            "https://linear.app/docs/login-methods",
            "https://help.figma.com/hc/en-us/articles/360039817634-Enable-two-factor-authentication-2FA",
            "https://vercel.com/docs/two-factor-authentication",
            "https://help.shopify.com/en/manual/your-account/logging-in/two-step-authentication/authenticator-app",
            "https://support.atlassian.com/security-and-access-policies/docs/authentication-policy-settings-for-your-organizations/"
          ]
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://auth0.com/docs/secure/multi-factor-authentication",
            "https://clerk.com/docs",
            "https://workos.com/docs/user-management/mfa",
            "https://firebase.google.com/docs/auth/web/multi-factor",
            "https://stytch.com/docs",
            "https://docs.kinde.com/"
          ]
        }
      ],
      "seedISC": "Users can enable TOTP authenticator-app based two-factor auth"
    },
    {
      "id": "sms-mfa",
      "capability": "SMS one-time-code 2FA",
      "dimension": "MFA",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 6,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/authentication",
            "https://slack.com/help/articles/204509068-Two-factor-authentication-2FA-for-Slack",
            "https://www.notion.com/help/two-step-verification",
            "https://linear.app/docs/login-methods",
            "https://help.figma.com/hc/en-us/articles/360039817634-Enable-two-factor-authentication-2FA",
            "https://help.shopify.com/en/manual/your-account/logging-in/two-step-authentication/sms"
          ]
        },
        {
          "cohort": "services",
          "shipping": 4,
          "of": 6,
          "refs": [
            "https://auth0.com/docs/secure/multi-factor-authentication",
            "https://clerk.com/docs",
            "https://firebase.google.com/docs/auth/web/multi-factor",
            "https://stytch.com/docs"
          ],
          "inferred": true
        }
      ],
      "seedISC": "Users can receive SMS one-time codes for two-factor auth"
    },
    {
      "id": "hardware-key-mfa",
      "capability": "Hardware security key / WebAuthn 2FA",
      "dimension": "MFA",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 3,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/authentication",
            "https://help.shopify.com/en/manual/your-account/logging-in/two-step-authentication/recovery-codes",
            "https://vercel.com/docs/two-factor-authentication"
          ]
        }
      ],
      "seedISC": "Users can register a hardware security key for 2FA"
    },
    {
      "id": "mfa-recovery-codes",
      "capability": "Recovery codes for 2FA",
      "dimension": "Recovery",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 6,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/authentication",
            "https://slack.com/help/articles/204509068-Two-factor-authentication-2FA-for-Slack",
            "https://www.notion.com/help/two-step-verification",
            "https://vercel.com/docs/two-factor-authentication",
            "https://help.shopify.com/en/manual/your-account/logging-in/two-step-authentication/recovery-codes"
          ]
        },
        {
          "cohort": "services",
          "shipping": 2,
          "of": 6,
          "refs": [
            "https://auth0.com/docs/secure/multi-factor-authentication",
            "https://clerk.com/docs/authentication/configuration/sign-up-sign-in-options"
          ]
        }
      ],
      "seedISC": "Users receive one-time recovery codes when enabling 2FA"
    },
    {
      "id": "adaptive-risk-mfa",
      "capability": "Adaptive / risk-based step-up MFA",
      "dimension": "MFA",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 2,
          "of": 6,
          "refs": [
            "https://auth0.com/pricing",
            "https://stytch.com/docs/fraud/guides/device-fingerprinting/overview"
          ]
        }
      ],
      "seedISC": "Step-up MFA triggers automatically on login risk signals"
    },
    {
      "id": "mandatory-mfa-policy",
      "capability": "Admin-enforced mandatory 2FA policy",
      "dimension": "Governance",
      "tier": "T2",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 5,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/authentication",
            "https://slack.com/help/articles/204509068-Two-factor-authentication-2FA-for-Slack",
            "https://vercel.com/docs/two-factor-enforcement",
            "https://help.figma.com/hc/en-us/articles/360039817634-Enable-two-factor-authentication-2FA",
            "https://support.atlassian.com/security-and-access-policies/docs/authentication-policy-settings-for-your-organizations/"
          ]
        }
      ],
      "seedISC": "Admins can require two-factor auth for all workspace members"
    },
    {
      "id": "active-session-list",
      "capability": "Active-session list (self-service)",
      "dimension": "Sessions",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 1,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/authentication"
          ]
        },
        {
          "cohort": "services",
          "shipping": 5,
          "of": 6,
          "refs": [
            "https://auth0.com/docs/authenticate",
            "https://clerk.com/docs",
            "https://workos.com/docs/user-management",
            "https://stytch.com/docs",
            "https://docs.kinde.com/"
          ],
          "inferred": true,
          "note": "count from one combined session-management APIs table line (coarse across the split rows)"
        }
      ],
      "seedISC": "Users can view a list of their own active sessions"
    },
    {
      "id": "per-session-revoke",
      "capability": "Per-session revoke (self-service)",
      "dimension": "Sessions",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 1,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/authentication"
          ]
        },
        {
          "cohort": "services",
          "shipping": 5,
          "of": 6,
          "refs": [
            "https://auth0.com/docs/authenticate",
            "https://clerk.com/docs",
            "https://workos.com/docs/user-management",
            "https://stytch.com/docs",
            "https://docs.kinde.com/"
          ],
          "inferred": true,
          "note": "count from one combined session-management APIs table line (coarse across the split rows)"
        }
      ],
      "seedISC": "Users can revoke an individual active session on demand"
    },
    {
      "id": "revoke-all-sessions",
      "capability": "Revoke-all-sessions (self-service)",
      "dimension": "Sessions",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 1,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/authentication"
          ]
        },
        {
          "cohort": "services",
          "shipping": 5,
          "of": 6,
          "refs": [
            "https://auth0.com/docs/authenticate",
            "https://clerk.com/docs",
            "https://workos.com/docs/user-management",
            "https://stytch.com/docs",
            "https://docs.kinde.com/"
          ],
          "inferred": true,
          "note": "count from one combined session-management APIs table line (coarse across the split rows)"
        }
      ],
      "seedISC": "Users can sign out of all active sessions at once"
    },
    {
      "id": "admin-mass-session-reset",
      "capability": "Admin-triggered mass session reset (org-wide forced logout)",
      "dimension": "Sessions",
      "tier": "T3",
      "contextRider": "enterprise-sso",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 1,
          "of": 8,
          "refs": [
            "https://support.atlassian.com/security-and-access-policies/docs/authentication-policy-settings-for-your-organizations/"
          ]
        }
      ],
      "seedISC": "Admins can force sign-out for every user in the org"
    },
    {
      "id": "new-device-signin-alert",
      "capability": "New-device sign-in email alert",
      "dimension": "Protection",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 2,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/authentication",
            "https://help.shopify.com/en/manual/your-account/manage-account/two-step-authentication"
          ],
          "inferred": true
        }
      ],
      "seedISC": "Users receive an email alert on unrecognized new-device sign-in"
    },
    {
      "id": "session-idle-timeout",
      "capability": "Session idle-timeout admin control",
      "dimension": "Governance",
      "tier": "T3",
      "contextRider": "enterprise-sso",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 2,
          "of": 8,
          "refs": [
            "https://support.atlassian.com/security-and-access-policies/docs/authentication-policy-settings-for-your-organizations/",
            "https://slack.com/help/articles/204509068-Two-factor-authentication-2FA-for-Slack"
          ]
        }
      ],
      "seedISC": "Admins can configure an idle-session timeout for the workspace"
    },
    {
      "id": "session-max-lifetime",
      "capability": "Fixed session-expiration (max lifetime) admin control",
      "dimension": "Governance",
      "tier": "T3",
      "contextRider": "enterprise-sso",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 2,
          "of": 8,
          "refs": [
            "https://support.atlassian.com/security-and-access-policies/docs/authentication-policy-settings-for-your-organizations/",
            "https://vercel.com/docs/saml"
          ]
        }
      ],
      "seedISC": "Admins can cap the absolute maximum session lifetime allowed"
    },
    {
      "id": "stepup-reauth-sensitive-actions",
      "capability": "Step-up re-authentication for sensitive actions (sudo mode)",
      "dimension": "Protection",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 1,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/authentication"
          ]
        }
      ],
      "seedISC": "Sensitive account actions require fresh re-authentication first",
      "notes": "Below-cutoff, encoded premium-notable: sudo-mode is a security-critical pattern (skeptic F1 — cutoff consistency)."
    },
    {
      "id": "password-reset-flow",
      "capability": "Password reset flow",
      "dimension": "Recovery",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 7,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/authentication",
            "https://slack.com/help/articles/204509068-Two-factor-authentication-2FA-for-Slack",
            "https://www.notion.com/help/two-step-verification",
            "https://help.figma.com/hc/en-us/articles/360039817634-Enable-two-factor-authentication-2FA",
            "https://vercel.com/docs/security",
            "https://help.shopify.com/en/manual/your-account/manage-account/two-step-authentication",
            "https://support.atlassian.com/security-and-access-policies/docs/authentication-policy-settings-for-your-organizations/"
          ],
          "inferred": true
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://auth0.com/docs/authenticate",
            "https://clerk.com/docs",
            "https://workos.com/docs/events",
            "https://firebase.google.com/docs/auth",
            "https://stytch.com/docs",
            "https://docs.kinde.com/"
          ]
        }
      ],
      "seedISC": "Users can reset a forgotten password via emailed reset link",
      "groundingException": "in-app count architecturally universal but table-marked INFERRED (account-security basics not re-fetched this pass) — doc-thin table-stakes"
    },
    {
      "id": "email-verification-signup",
      "capability": "Email verification on signup",
      "dimension": "Sign-In",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 8,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/authentication",
            "https://slack.com/help/articles/204509068-Two-factor-authentication-2FA-for-Slack",
            "https://www.notion.com/help/two-step-verification",
            "https://linear.app/docs/login-methods",
            "https://help.figma.com/hc/en-us/articles/360039817634-Enable-two-factor-authentication-2FA",
            "https://vercel.com/docs/security",
            "https://help.shopify.com/en/manual/your-account/manage-account/two-step-authentication",
            "https://support.atlassian.com/security-and-access-policies/docs/authentication-policy-settings-for-your-organizations/"
          ],
          "inferred": true
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://auth0.com/docs/authenticate",
            "https://clerk.com/docs",
            "https://workos.com/docs/user-management",
            "https://firebase.google.com/docs/auth",
            "https://stytch.com/docs",
            "https://docs.kinde.com/"
          ]
        }
      ],
      "seedISC": "New accounts must verify their email address after signup",
      "groundingException": "in-app count architecturally universal but table-marked INFERRED (account-security basics not re-fetched this pass) — doc-thin table-stakes"
    },
    {
      "id": "sso-saml-oidc",
      "capability": "SSO (SAML/OIDC) enterprise login",
      "dimension": "Enterprise",
      "tier": "T1",
      "contextRider": "enterprise-sso",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 7,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/authentication",
            "https://slack.com/help/articles/204509068-Two-factor-authentication-2FA-for-Slack",
            "https://www.notion.com/help/saml-sso-configuration",
            "https://linear.app/docs/saml-and-access-control",
            "https://help.figma.com/hc/en-us/articles/360040532333-Guide-to-SAML-SSO",
            "https://vercel.com/docs/saml",
            "https://support.atlassian.com/security-and-access-policies/docs/authentication-policy-settings-for-your-organizations/"
          ]
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://auth0.com/docs/authenticate",
            "https://clerk.com/docs",
            "https://workos.com/docs/sso",
            "https://firebase.google.com/docs/auth",
            "https://stytch.com/docs",
            "https://docs.kinde.com/",
            "https://kinde.com/pricing/"
          ]
        }
      ],
      "seedISC": "Organizations can configure SAML or OIDC single sign-on"
    },
    {
      "id": "sso-enforcement",
      "capability": "SSO enforcement (restrict to SSO-only login)",
      "dimension": "Enterprise",
      "tier": "T1",
      "contextRider": "enterprise-sso",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 6,
          "of": 8,
          "refs": [
            "https://www.notion.com/help/saml-sso-configuration",
            "https://help.figma.com/hc/en-us/articles/360040532333-Guide-to-SAML-SSO",
            "https://slack.com/help/articles/204509068-Two-factor-authentication-2FA-for-Slack",
            "https://support.atlassian.com/security-and-access-policies/docs/authentication-policy-settings-for-your-organizations/",
            "https://linear.app/docs/login-methods",
            "https://docs.github.com/en/authentication"
          ],
          "inferred": true
        }
      ],
      "seedISC": "Admins can restrict login to SSO only, blocking other methods"
    },
    {
      "id": "scim-provisioning",
      "capability": "SCIM automated provisioning/deprovisioning",
      "dimension": "Enterprise",
      "tier": "T1",
      "contextRider": "enterprise-sso",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 6,
          "of": 8,
          "refs": [
            "https://www.notion.com/help/set-up-identity-provider-for-scim",
            "https://linear.app/docs/scim",
            "https://help.figma.com/hc/en-us/articles/360040532333-Guide-to-SAML-SSO",
            "https://slack.com/help/articles/204509068-Two-factor-authentication-2FA-for-Slack",
            "https://support.atlassian.com/security-and-access-policies/docs/authentication-policy-settings-for-your-organizations/",
            "https://docs.github.com/en/authentication"
          ],
          "inferred": true
        },
        {
          "cohort": "services",
          "shipping": 3,
          "of": 6,
          "refs": [
            "https://auth0.com/docs/authenticate",
            "https://workos.com/docs/user-management",
            "https://stytch.com/docs"
          ]
        }
      ],
      "seedISC": "SCIM automatically provisions and deprovisions users from the IdP"
    },
    {
      "id": "account-lockout-bruteforce",
      "capability": "Account lockout / brute-force rate limiting",
      "dimension": "Protection",
      "tier": "T1",
      "mandatedBy": "a-sign-in-and-password",
      "groundingException": "in-app count architecturally universal but table-marked INFERRED (account-security basics not re-fetched this pass) — doc-thin table-stakes",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 8,
          "of": 8,
          "refs": [],
          "inferred": true
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://auth0.com/docs/authenticate",
            "https://clerk.com/docs",
            "https://stytch.com/docs",
            "https://docs.kinde.com/"
          ],
          "inferred": true
        }
      ],
      "seedISC": "Failed sign-ins trigger progressive rate limiting and lockout"
    },
    {
      "id": "security-audit-log",
      "capability": "Sign-in / security audit log",
      "dimension": "Governance",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 3,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/reviewing-your-security-log"
          ],
          "inferred": true
        },
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://auth0.com/docs/authenticate",
            "https://clerk.com/pricing",
            "https://workos.com/docs/events",
            "https://firebase.google.com/docs/auth",
            "https://stytch.com/docs",
            "https://docs.kinde.com/"
          ]
        }
      ],
      "seedISC": "Admins can view a sign-in and security event audit log"
    },
    {
      "id": "refresh-token-rotation",
      "capability": "Refresh-token rotation",
      "dimension": "Sessions",
      "tier": "T1",
      "groundingException": "Services evidence is majority-inferred from standard OAuth2/OIDC behavior rather than separately documented per vendor (only Auth0 and Firebase confirm explicitly). Promoted to T1 anyway because rotation is foundational session-security hygiene whose absence directly enables the 'stale token keeps working after revocation' anti-pattern.",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://auth0.com/docs/authenticate",
            "https://firebase.google.com/docs/auth",
            "https://clerk.com/docs",
            "https://workos.com/docs/user-management",
            "https://stytch.com/docs",
            "https://docs.kinde.com/"
          ],
          "inferred": true
        }
      ],
      "seedISC": "Refresh tokens rotate automatically on each use"
    },
    {
      "id": "jwt-claims-customization",
      "capability": "JWT customization (custom claims / templates)",
      "dimension": "Sessions",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://auth0.com/docs/authenticate",
            "https://clerk.com/docs",
            "https://workos.com/docs/user-management",
            "https://firebase.google.com/docs/auth",
            "https://stytch.com/docs",
            "https://docs.kinde.com/"
          ],
          "inferred": true
        }
      ],
      "seedISC": "Session tokens support custom claims for roles and permissions",
      "groundingException": "services 6/6 with Kinde custom-claims inferred from its OIDC token model (miner note) — 5/6 doc-quoted"
    },
    {
      "id": "auth-event-webhooks",
      "capability": "Webhooks on auth events",
      "dimension": "Governance",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://auth0.com/docs/authenticate",
            "https://clerk.com/docs",
            "https://workos.com/docs/events",
            "https://firebase.google.com/docs/auth",
            "https://stytch.com/docs",
            "https://docs.kinde.com/"
          ]
        }
      ],
      "seedISC": "Auth events like login and password change fire webhooks"
    },
    {
      "id": "prebuilt-login-ui",
      "capability": "Pre-built / hosted login UI components",
      "dimension": "Sign-In",
      "tier": "T1",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 6,
          "of": 6,
          "refs": [
            "https://auth0.com/docs/authenticate",
            "https://clerk.com/docs",
            "https://workos.com/docs/sso",
            "https://firebase.google.com/docs/auth",
            "https://stytch.com/docs",
            "https://docs.kinde.com/"
          ]
        }
      ],
      "seedISC": "The platform ships pre-built, hosted login UI components"
    },
    {
      "id": "bot-detection-signup",
      "capability": "Bot detection (login/signup-time)",
      "dimension": "Protection",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 5,
          "of": 6,
          "refs": [
            "https://auth0.com/docs/secure/attack-protection/bot-detection/configure-captcha",
            "https://auth0.com/pricing",
            "https://clerk.com/docs",
            "https://workos.com/docs/user-management",
            "https://firebase.google.com/docs/auth",
            "https://stytch.com/docs"
          ]
        }
      ],
      "seedISC": "Signup and login attempts are screened for automated bots"
    },
    {
      "id": "breached-password-detection",
      "capability": "Breached-password detection",
      "dimension": "Protection",
      "tier": "T3",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 3,
          "of": 6,
          "refs": [
            "https://auth0.com/pricing",
            "https://workos.com/docs/user-management",
            "https://stytch.com/docs"
          ]
        }
      ],
      "seedISC": "New passwords are checked against known breached-password lists"
    },
    {
      "id": "custom-auth-domain",
      "capability": "Custom domains (branded auth/API domain)",
      "dimension": "Enterprise",
      "tier": "T3",
      "contextRider": "enterprise-sso",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 4,
          "of": 6,
          "refs": [
            "https://auth0.com/docs/authenticate",
            "https://workos.com/pricing",
            "https://firebase.google.com/pricing",
            "https://kinde.com/pricing/"
          ],
          "inferred": true
        }
      ],
      "seedISC": "Organizations can serve login pages from a branded domain"
    },
    {
      "id": "personal-access-tokens",
      "capability": "Personal access tokens / API token management",
      "dimension": "Sessions",
      "tier": "T2",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 4,
          "of": 8,
          "refs": [
            "https://docs.github.com/en/authentication",
            "https://support.atlassian.com/security-and-access-policies/docs/authentication-policy-settings-for-your-organizations/",
            "https://vercel.com/docs/security",
            "https://linear.app/docs/login-methods"
          ],
          "inferred": true
        }
      ],
      "seedISC": "Users can generate personal access tokens for API access"
    },
    {
      "id": "api-token-expiration-policy",
      "capability": "API token expiration policy (admin-set)",
      "dimension": "Governance",
      "tier": "T3",
      "contextRider": "enterprise-sso",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 1,
          "of": 8,
          "refs": [
            "https://support.atlassian.com/security-and-access-policies/docs/authentication-policy-settings-for-your-organizations/"
          ]
        }
      ],
      "seedISC": "Admins can set an org-wide expiration policy for API tokens"
    },
    {
      "id": "ip-allowlist-workspace",
      "capability": "IP allowlisting / network restriction for workspace access",
      "dimension": "Enterprise",
      "tier": "T3",
      "contextRider": "enterprise-sso",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 1,
          "of": 8,
          "refs": [
            "https://linear.app/security"
          ]
        }
      ],
      "seedISC": "Admins can restrict workspace access to an IP allowlist"
    },
    {
      "id": "sso-first-login-verification-pin",
      "capability": "Verification PIN/code on first SSO/SCIM login",
      "dimension": "Enterprise",
      "tier": "T3",
      "contextRider": "enterprise-sso",
      "evidence": [
        {
          "cohort": "inapp",
          "shipping": 1,
          "of": 8,
          "refs": [
            "https://help.figma.com/hc/en-us/articles/360039817634-Enable-two-factor-authentication-2FA"
          ]
        }
      ],
      "seedISC": "A one-time PIN verifies a user's first SSO login"
    },
    {
      "id": "self-hosting-option",
      "capability": "Self-hosting / private deployment option",
      "dimension": "Enterprise",
      "tier": "T3",
      "contextRider": "self-hosted-deployment",
      "evidence": [
        {
          "cohort": "services",
          "shipping": 1,
          "of": 6,
          "refs": [
            "https://auth0.com/pricing",
            "https://kinde.com/pricing/"
          ]
        }
      ],
      "seedISC": "The auth system can be deployed as a private instance"
    }
  ],
  "antiCriteria": [
    {
      "id": "a-passwords-must-not-be",
      "rule": "Passwords MUST NOT be stored or logged in plaintext or reversible encryption",
      "why": "Prevents a database breach or log leak from exposing every user's real password; guards password-auth and password-reset-flow."
    },
    {
      "id": "a-all-other-active-sessions",
      "rule": "All other active sessions MUST be revoked when a user changes their password",
      "why": "Prevents an attacker who already stole a session token from persisting access after the legitimate user rotates credentials; guards password-reset-flow, revoke-all-sessions."
    },
    {
      "id": "a-sign-in-and-password",
      "rule": "Sign-in and password-reset endpoints MUST enforce rate limiting and lockout after repeated failures",
      "why": "Prevents unlimited brute-force or credential-stuffing attempts against password-auth and password-reset-flow; mandates account-lockout-bruteforce to T1."
    },
    {
      "id": "a-account-recovery-flows-must",
      "rule": "Account-recovery flows MUST NOT allow bypassing an enabled 2FA factor",
      "why": "Prevents an attacker who compromises only the recovery channel (e.g. email) from defeating MFA the user explicitly turned on; guards totp-mfa, sms-mfa, mfa-recovery-codes."
    },
    {
      "id": "a-session-and-auth-tokens",
      "rule": "Session and auth tokens MUST NOT be transmitted or stored in URL query parameters",
      "why": "Prevents token leakage via browser history, server access logs, and Referer headers; guards refresh-token-rotation, jwt-claims-customization."
    },
    {
      "id": "a-magic-links-and-one",
      "rule": "Magic links and one-time codes MUST expire quickly and MUST be single-use",
      "why": "Prevents a leaked or intercepted link/code from granting indefinite or repeated access; guards magic-link-signin."
    },
    {
      "id": "a-scim-sso-deprovisioned-users",
      "rule": "SCIM/SSO-deprovisioned users MUST lose session access within minutes, not at next token expiry",
      "why": "Prevents an offboarded employee from retaining a live session long after the identity provider revokes them; guards scim-provisioning, sso-enforcement."
    },
    {
      "id": "a-revocation-of-a-session",
      "rule": "Revocation of a session or token MUST take effect immediately, not only after the access-token TTL elapses",
      "why": "Prevents a supposedly-revoked per-session-revoke or admin-mass-session-reset action from being cosmetic while a stale token keeps working."
    },
    {
      "id": "a-account-lockout-must-not",
      "rule": "Account lockout MUST NOT be triggerable by an attacker to lock out a legitimate user from an unauthenticated request",
      "why": "Prevents a denial-of-service abuse of account-lockout-bruteforce that turns a defense into an attack vector."
    },
    {
      "id": "a-sensitive-actions-without-reauth",
      "rule": "Never allow credential, 2FA, or email changes without step-up re-authentication",
      "why": "a stolen live session must not silently take over the account — guards stepup-reauth-sensitive-actions"
    },
    {
      "id": "a-sso-lockout",
      "rule": "Never enforce SSO-only sign-in before the connection is verified working",
      "why": "a broken SSO config with passwords disabled locks out the whole org — guards sso-enforcement"
    }
  ],
  "sources": [
    "https://docs.github.com/en/authentication",
    "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/reviewing-your-security-log",
    "https://slack.com/help/articles/204509068-Two-factor-authentication-2FA-for-Slack",
    "https://www.notion.com/help/two-step-verification",
    "https://www.notion.com/help/saml-sso-configuration",
    "https://www.notion.com/help/set-up-identity-provider-for-scim",
    "https://www.notion.com/help/provision-users-and-groups-with-scim",
    "https://linear.app/docs/saml-and-access-control",
    "https://linear.app/docs/scim",
    "https://linear.app/docs/login-methods",
    "https://linear.app/security",
    "https://help.figma.com/hc/en-us/articles/360040532333-Guide-to-SAML-SSO",
    "https://help.figma.com/hc/en-us/articles/360039817634-Enable-two-factor-authentication-2FA",
    "https://help.figma.com/hc/en-us/articles/360052497994-Set-login-and-authentication-method",
    "https://vercel.com/docs/security",
    "https://vercel.com/docs/two-factor-authentication",
    "https://vercel.com/docs/two-factor-enforcement",
    "https://vercel.com/docs/saml",
    "https://help.shopify.com/en/manual/your-account/manage-account/two-step-authentication",
    "https://help.shopify.com/en/manual/your-account/logging-in/two-step-authentication/authenticator-app",
    "https://help.shopify.com/en/manual/your-account/logging-in/two-step-authentication/sms",
    "https://help.shopify.com/en/manual/your-account/logging-in/two-step-authentication/recovery-codes",
    "https://help.shopify.com/en/manual/your-account/account-security/two-step-authentication/push-notification",
    "https://support.atlassian.com/security-and-access-policies/docs/authentication-policy-settings-for-your-organizations/",
    "https://www.notion.com/help/account-security",
    "https://linear.app/docs/security",
    "https://help.figma.com/hc/en-us/articles/360040071573-Enforce-SSO-provisioning-and-security-settings",
    "https://support.atlassian.com/security-and-access-policies/docs/what-are-organization-security-policies/",
    "https://auth0.com/docs/authenticate",
    "https://auth0.com/pricing",
    "https://auth0.com/docs/secure/multi-factor-authentication",
    "https://auth0.com/docs/secure/attack-protection/bot-detection/configure-captcha",
    "https://clerk.com/docs",
    "https://clerk.com/pricing",
    "https://clerk.com/docs/authentication/configuration/sign-up-sign-in-options",
    "https://clerk.com/docs/users/user-impersonation",
    "https://workos.com/docs/sso",
    "https://workos.com/docs/user-management",
    "https://workos.com/pricing",
    "https://workos.com/docs/user-management/mfa",
    "https://workos.com/docs/events",
    "https://firebase.google.com/docs/auth",
    "https://firebase.google.com/pricing",
    "https://firebase.google.com/docs/auth/web/multi-factor",
    "https://firebase.google.com/docs/auth/web/account-linking",
    "https://firebase.google.com/docs/auth/admin/import-users",
    "https://stytch.com/docs",
    "https://stytch.com/pricing",
    "https://stytch.com/docs/fraud/guides/device-fingerprinting/overview",
    "https://docs.kinde.com/",
    "https://kinde.com/pricing/"
  ]
} as Archetype;

export default AuthSession;
