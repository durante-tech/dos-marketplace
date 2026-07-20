/**
 * Media / Asset Library archetype — first archetype in the corpus.
 * Migrated from the 2026-07-08 pilot (Docs/Research/feature-archetype-media-pilot.md
 * in the dos repo), grounded in two live-doc cohorts fetched 2026-07-08.
 */
import type { Archetype } from '../Schema/Archetype';

export const MediaAssetLibrary: Archetype = {
  name: 'media-asset-library',
  title: 'Media / Asset Library',
  version: '0.5.0',
  updated: '2026-07-09',
  cohorts: [
    {
      id: 'inapp',
      label: 'In-app media libraries (sets user expectations)',
      references: [
        'WordPress',
        'Strapi',
        'Payload',
        'Sanity',
        'Shopify Files',
        'Webflow',
        'Ghost',
        'Notion',
      ],
    },
    {
      id: 'services',
      label: 'Dedicated media services (API-tier norms; universal here forces T1)',
      references: [
        'Cloudinary',
        'ImageKit',
        'Uploadthing',
        'Filestack',
        'Bytescale',
        'Transloadit',
      ],
    },
  ],
  tierDefinitions: {
    T1: 'Table-stakes: essentially all in-app references ship it (>=6/8), OR it is universal across the services cohort — that override is unconditional and applies even when in-app coverage is low (in-app UIs hide backend capabilities; demoting a universal capability requires a groundingException). Absence reads as broken/unfinished. MUST be built or deferred-with-ledger-row; silent absence is the failure.',
    T2: 'Expected: majority of in-app references (4-5/8). Absence is a known limitation users ask about within weeks. Deferral needs a one-line reason.',
    T3: 'Delighter: rare or absent among market references (<=3/8 in-app, including 0 and rows with no in-app evidence at all, unless the universality override applies). Optional; building one while T1 rows are silent-absent is the anti-pattern. (A declared groundingException in the row data — never inferred by a reviewer — is the only other path to T1.)',
  },
  rows: [
    // ── Ingest ──
    {
      id: 'file-picker-upload',
      capability: 'File-picker upload to library',
      dimension: 'Ingest',
      tier: 'T1',
      evidence: [
        { cohort: 'inapp', shipping: 8, of: 8 },
        { cohort: 'services', shipping: 6, of: 6 },
      ],
      seedISC: 'User can upload a file into the library',
    },
    {
      id: 'drag-drop-upload',
      capability: 'Drag-and-drop upload',
      dimension: 'Ingest',
      tier: 'T1',
      evidence: [{ cohort: 'inapp', shipping: 8, of: 8, note: 'Shopify inferred' }],
      seedISC: 'Dropping a file onto the library ingests it',
    },
    {
      id: 'bulk-upload',
      capability: 'Bulk multi-file upload',
      dimension: 'Ingest',
      tier: 'T1',
      notes:
        'archer gen-1 re-tier T2→T1: in-app 6/8 meets the ≥6/8 bar and services-universal 6/6 (uniform OR-clause, billing-skeptic ruling 2026-07-08)',
      evidence: [
        { cohort: 'inapp', shipping: 6, of: 8 },
        { cohort: 'services', shipping: 6, of: 6 },
      ],
      seedISC: 'Multiple files upload in one action with per-file progress',
    },
    {
      id: 'url-import',
      capability: 'Remote URL import',
      dimension: 'Ingest',
      tier: 'T1',
      notes:
        'archer gen-1 re-tier T2→T1: services-universal 6/6 (uniform OR-clause, billing-skeptic ruling 2026-07-08); in-app 3/8 — H5 per-layer-authority candidate',
      evidence: [
        { cohort: 'inapp', shipping: 3, of: 8 },
        { cohort: 'services', shipping: 6, of: 6 },
      ],
      seedISC: 'Pasting a remote URL ingests the file server-side',
    },
    {
      id: 'type-size-enforcement',
      capability: 'Type/size enforcement with clear rejection UX',
      dimension: 'Ingest',
      tier: 'T1',
      evidence: [{ cohort: 'inapp', shipping: 8, of: 8 }],
      seedISC: 'Rejected files show the limit that rejected them',
    },
    {
      id: 'ai-generation-in-library',
      capability: 'In-library AI generation',
      dimension: 'Ingest',
      tier: 'T3',
      evidence: [
        { cohort: 'inapp', shipping: 2, of: 8, note: 'Shopify Magic, Sanity Functions' },
      ],
      seedISC: 'User can generate net-new media from a prompt in-library',
    },
    // ── Organization ──
    {
      id: 'alt-text',
      capability: 'Editable alt text field',
      dimension: 'Organization',
      tier: 'T1',
      evidence: [{ cohort: 'inapp', shipping: 7, of: 8 }],
      seedISC: 'Each asset carries user-editable alt text',
    },
    {
      id: 'rename-title',
      capability: 'Title/rename post-creation',
      dimension: 'Organization',
      tier: 'T1',
      evidence: [{ cohort: 'inapp', shipping: 6, of: 8 }],
      seedISC: 'Asset display name is editable after creation',
      notes:
        'archer gen-2 re-tier T2→T1: in-app 6/8 meets the T1 bar once the 6/8 boundary overlap is resolved (billing-precedent bands: T2=4-5/8)',
    },
    {
      id: 'caption',
      capability: 'Caption/description field',
      dimension: 'Organization',
      tier: 'T2',
      evidence: [{ cohort: 'inapp', shipping: 4, of: 8 }],
      seedISC: 'Asset carries an optional caption',
    },
    {
      id: 'folders',
      capability: 'Nestable folders',
      dimension: 'Organization',
      tier: 'T2',
      evidence: [
        { cohort: 'inapp', shipping: 4, of: 8, note: 'WordPress lacks native folders' },
        { cohort: 'services', shipping: 3, of: 6 },
      ],
      seedISC: 'Assets organize into nestable folders',
    },
    {
      id: 'tags',
      capability: 'Freeform tags',
      dimension: 'Organization',
      tier: 'T3',
      evidence: [
        { cohort: 'inapp', shipping: 1, of: 8, note: 'NOT table-stakes in-app' },
        { cohort: 'services', shipping: 4, of: 6 },
      ],
      seedISC: 'Assets carry freeform tags, filterable in the library',
      notes: 'Single-cohort grounding would mis-tier this — services say yes, in-app says no.',
    },
    {
      id: 'collections',
      capability: 'Collections (cross-folder groupings)',
      dimension: 'Organization',
      tier: 'T3',
      evidence: [
        { cohort: 'inapp', shipping: 1, of: 8, note: 'Sanity' },
        { cohort: 'services', shipping: 2, of: 6 },
      ],
      seedISC: 'Asset can belong to multiple named collections',
    },
    // ── Retrieval ──
    {
      id: 'text-search',
      capability: 'Text search',
      dimension: 'Retrieval',
      tier: 'T1',
      evidence: [{ cohort: 'inapp', shipping: 6, of: 8 }],
      seedISC: 'Library is searchable by name or prompt text',
    },
    {
      id: 'filters',
      capability: 'Filters (type/date/status)',
      dimension: 'Retrieval',
      tier: 'T2',
      evidence: [{ cohort: 'inapp', shipping: 5, of: 8 }],
      seedISC: 'Library filters by type, date, and status',
    },
    {
      id: 'user-sort',
      capability: 'User-controlled sort',
      dimension: 'Retrieval',
      tier: 'T1',
      evidence: [{ cohort: 'inapp', shipping: 6, of: 8 }],
      seedISC: 'User can sort by date, name, or size',
      notes:
        'archer gen-2 re-tier T2→T1: in-app 6/8 meets the T1 bar once the 6/8 boundary overlap is resolved (pilot tiered 6/8 inconsistently — text-search T1 vs this row T2)',
    },
    {
      id: 'pagination',
      capability: 'Pagination',
      dimension: 'Retrieval',
      tier: 'T1',
      evidence: [{ cohort: 'inapp', shipping: 3, of: 8, note: 'explicit in docs; universal in practice' }],
      seedISC: 'Library paginates without loading the full corpus',
      groundingException:
        'Universal in practice; product docs rarely document pagination explicitly (3/8 doc-confirmed)',
    },
    {
      id: 'grid-list-toggle',
      capability: 'Grid/list view toggle',
      dimension: 'Retrieval',
      tier: 'T3',
      evidence: [{ cohort: 'inapp', shipping: 2, of: 8 }],
      seedISC: 'User switches between grid and list density',
    },
    // ── Lifecycle ──
    {
      id: 'single-delete',
      capability: 'Single-asset delete (rows + bytes)',
      dimension: 'Lifecycle',
      tier: 'T1',
      evidence: [
        { cohort: 'inapp', shipping: 8, of: 8 },
        { cohort: 'services', shipping: 6, of: 6 },
      ],
      seedISC: 'User can delete an asset; DB row and storage bytes both removed',
    },
    {
      id: 'bulk-delete',
      capability: 'Bulk delete (multi-select)',
      dimension: 'Lifecycle',
      tier: 'T1',
      notes:
        'archer gen-2 re-tier T2→T1: in-app 6/8 meets the T1 bar once the 6/8 boundary overlap is resolved (billing-precedent bands: T2=4-5/8)',
      evidence: [
        { cohort: 'inapp', shipping: 6, of: 8 },
        { cohort: 'services', shipping: 4, of: 6 },
      ],
      seedISC: 'Multi-selected assets delete in one action',
    },
    {
      id: 'replace-preserve-url',
      capability: 'Replace file preserving URL/references',
      dimension: 'Lifecycle',
      tier: 'T1',
      notes:
        'archer gen-2 re-tier T2→T1: in-app 6/8 meets the T1 bar once the 6/8 boundary overlap is resolved (billing-precedent bands: T2=4-5/8)',
      evidence: [
        { cohort: 'inapp', shipping: 6, of: 8 },
        { cohort: 'services', shipping: 3, of: 6 },
      ],
      seedISC: 'Replacing a file keeps every existing reference working',
    },
    {
      id: 'trash-restore',
      capability: 'Trash/restore window',
      dimension: 'Lifecycle',
      tier: 'T3',
      evidence: [{ cohort: 'inapp', shipping: 0, of: 8, note: 'market whitespace — nobody ships it' }],
      seedISC: 'Deleted assets are restorable for N days',
    },
    {
      id: 'versioning-revert',
      capability: 'Version history with revert',
      dimension: 'Lifecycle',
      tier: 'T3',
      evidence: [
        { cohort: 'inapp', shipping: 1, of: 8, note: 'Sanity' },
        { cohort: 'services', shipping: 2, of: 6, note: 'the DAM-vs-upload-API dividing line' },
      ],
      seedISC: 'Prior asset versions are viewable and restorable',
    },
    {
      id: 'org-delete-sweep',
      riderRationale:
        'tenant deletion must sweep storage bytes or tenancy leaks — non-negotiable within multitenant shape (basis derived gen-18 from row semantics; mint-time record predates the field — re-derive at next re-mine)',
      capability: 'Tenant-delete storage sweep',
      dimension: 'Lifecycle',
      tier: 'T1',
      evidence: [],
      seedISC: 'Deleting the tenant removes rows AND stored bytes',
      contextRider: 'saas-multitenant',
    },
    {
      id: 'dsar-erasure',
      riderRationale:
        'compliance-expected within multitenant SaaS; urgency scales with jurisdiction exposure (basis derived gen-18 from row semantics; mint-time record predates the field — re-derive at next re-mine)',
      capability: 'User-data erasure (DSAR) path',
      dimension: 'Lifecycle',
      tier: 'T2',
      evidence: [],
      seedISC: 'Account deletion redacts attribution on tenant-retained assets',
      contextRider: 'saas-multitenant',
    },
    {
      id: 'cancel-in-flight',
      riderRationale:
        'expected control for long-running generation jobs; users hit its absence quickly (basis derived gen-18 from row semantics; mint-time record predates the field — re-derive at next re-mine)',
      capability: 'Cancel in-flight generation',
      dimension: 'Lifecycle',
      tier: 'T2',
      evidence: [],
      seedISC: 'User can cancel an in-flight generation job',
      contextRider: 'generation',
    },
    {
      id: 'retry-failed',
      riderRationale:
        'expected recovery affordance for failed generation jobs (basis derived gen-18 from row semantics; mint-time record predates the field — re-derive at next re-mine)',
      capability: 'One-click retry of failed generation',
      dimension: 'Lifecycle',
      tier: 'T2',
      evidence: [],
      seedISC: 'Failed generation retries in one click under a fresh key',
      contextRider: 'generation',
    },
    // ── Access & Delivery ──
    {
      id: 'tenant-isolation',
      riderRationale:
        'cross-tenant asset leakage is a security failure — non-negotiable within multitenant shape (basis derived gen-18 from row semantics; mint-time record predates the field — re-derive at next re-mine)',
      capability: 'Tenant isolation on every query',
      dimension: 'Access & Delivery',
      tier: 'T1',
      evidence: [],
      seedISC: 'Every asset query tenant-scoped; foreign IDs return 404',
      contextRider: 'saas-multitenant',
    },
    {
      id: 'role-permissions',
      capability: 'Role-granular permissions',
      dimension: 'Access & Delivery',
      tier: 'T2',
      evidence: [{ cohort: 'inapp', shipping: 4, of: 8 }],
      seedISC: 'Upload and delete gated by role, not just membership',
    },
    {
      id: 'per-asset-visibility',
      capability: 'Per-asset visibility (public/private)',
      dimension: 'Access & Delivery',
      tier: 'T3',
      evidence: [
        { cohort: 'inapp', shipping: 1, of: 8 },
        { cohort: 'services', shipping: 3, of: 6 },
      ],
      seedISC: 'Asset visibility is togglable per asset',
    },
    {
      id: 'signed-urls',
      capability: 'Signed/expiring delivery URLs',
      dimension: 'Access & Delivery',
      tier: 'T1',
      evidence: [
        { cohort: 'services', shipping: 6, of: 6, note: 'universal even in minimal upload APIs' },
      ],
      seedISC: 'Private-tier asset URLs are signed or auth-gated, never guessable',
    },
    {
      id: 'download-original',
      capability: 'Download original file',
      dimension: 'Access & Delivery',
      tier: 'T1',
      notes:
        'archer gen-1 re-tier T2→T1: services-universal 6/6 (uniform OR-clause, billing-skeptic ruling 2026-07-08); in-app 4/8 — H5 per-layer-authority candidate',
      evidence: [
        { cohort: 'inapp', shipping: 4, of: 8 },
        { cohort: 'services', shipping: 6, of: 6 },
      ],
      seedISC: 'Authenticated original-file download with attachment disposition',
    },
    {
      id: 'cross-feature-reuse',
      capability: 'Cross-feature asset reuse (picker)',
      dimension: 'Access & Delivery',
      tier: 'T1',
      evidence: [
        { cohort: 'inapp', shipping: 8, of: 8, note: 'the point of a library in a CMS' },
      ],
      seedISC: 'Other features can browse and attach library assets',
    },
    {
      id: 'multi-kind',
      capability: 'Multi-kind support (video/audio/docs)',
      dimension: 'Access & Delivery',
      tier: 'T1',
      evidence: [{ cohort: 'inapp', shipping: 8, of: 8, note: 'video support' }],
      seedISC: 'Library handles video and audio kinds, not only images',
      notes:
        'archer gen-1 re-tier T2→T1: stored in-app evidence 8/8 mechanically meets the ≥6/8 bar; evidence re-verification belongs to a Stage-1 re-mine pass',
    },
    // ── Governance, Billing & States ──
    {
      id: 'quota-display',
      capability: 'Proactive quota/usage display',
      dimension: 'Governance & States',
      tier: 'T2',
      evidence: [{ cohort: 'services', shipping: 3, of: 6 }],
      seedISC: 'User sees X-of-Y usage before hitting the limit',
      contextRider: 'metered',
    },
    {
      id: 'moderation-gate',
      capability: 'Content moderation gate',
      dimension: 'Governance & States',
      tier: 'T3',
      evidence: [{ cohort: 'services', shipping: 2, of: 6 }],
      seedISC: 'Unsafe content is blocked before spend or storage',
    },
    {
      id: 'charge-once',
      riderRationale:
        'double-charging a metered generation is a billing-integrity failure — non-negotiable within metered shape (basis derived gen-18 from row semantics; mint-time record predates the field — re-derive at next re-mine)',
      capability: 'Charge-exactly-once economics',
      dimension: 'Governance & States',
      tier: 'T1',
      evidence: [],
      seedISC: 'Idempotent claim-first commit; no double-billing on retries',
      contextRider: 'metered',
    },
    {
      id: 'empty-states',
      capability: 'Empty state (incl. filtered-empty distinction)',
      dimension: 'Governance & States',
      tier: 'T1',
      evidence: [{ cohort: 'inapp', shipping: 0, of: 8, note: 'evidence-thin in docs, universal in practice' }],
      seedISC: 'Empty and no-filter-match states are distinct and helpful',
      groundingException:
        'Universal in practice; docs never screenshot empty states (0/8 doc-confirmed is an evidence gap, not a product gap)',
    },
    {
      id: 'loading-states',
      capability: 'Loading/progress states',
      dimension: 'Governance & States',
      tier: 'T1',
      evidence: [{ cohort: 'inapp', shipping: 0, of: 8, note: 'evidence-thin in docs, universal in practice' }],
      seedISC: 'In-flight work is visibly in progress',
      groundingException:
        'Universal in practice; upload-progress UI is never doc-enumerated (0/8 doc-confirmed is an evidence gap, not a product gap)',
    },
    {
      id: 'error-states',
      capability: 'Code-mapped error states',
      dimension: 'Governance & States',
      tier: 'T1',
      evidence: [{ cohort: 'inapp', shipping: 2, of: 8, note: 'documented; universal in practice' }],
      seedISC: 'Failures render friendly mapped messages, never raw codes',
      groundingException:
        'Universal in practice; only 2/8 document validation-error UX explicitly',
    },
    {
      id: 'audit-trail',
      capability: 'Audit trail (who/what/when)',
      dimension: 'Governance & States',
      tier: 'T3',
      evidence: [
        { cohort: 'inapp', shipping: 1, of: 8 },
        { cohort: 'services', shipping: 1, of: 6 },
      ],
      seedISC: 'Asset actions are logged with actor and timestamp',
    },
    {
      id: 'dimensions-surfaced',
      capability: 'Asset dimensions stored and displayed',
      dimension: 'Governance & States',
      tier: 'T2',
      evidence: [{ cohort: 'inapp', shipping: 4, of: 8, note: 'common in practice' }],
      seedISC: 'Image width and height are stored and displayed',
    },
    {
      id: 'usage-tracking',
      capability: 'Usage tracking (where is this used)',
      dimension: 'Governance & States',
      tier: 'T3',
      evidence: [{ cohort: 'inapp', shipping: 2, of: 8, note: 'Sanity, Shopify' }],
      seedISC: 'Asset detail shows every referencing location',
    },
  ],
  antiCriteria: [
    {
      id: 'a-delete-halves',
      rule: 'Delete MUST NOT remove the DB row while leaving storage bytes (or vice versa)',
      why: 'Ghost objects and broken references; byte sweep and row delete are one unit.',
    },
    {
      id: 'a-client-tenant-id',
      rule: 'No client-supplied tenant/organization id on any asset operation',
      why: 'Tenancy comes from the session seam; every new surface re-inherits this.',
    },
    {
      id: 'a-taxonomy-before-search',
      rule: 'No taxonomy features (tags/collections) before search exists',
      why: 'Organizing an unsearchable library is decoration; market data agrees (tags 0-1/8 in-app).',
    },
    {
      id: 'a-guessable-private-urls',
      rule: 'No public-guessable permanent URLs for private-tier assets',
      why: 'Key-obscurity is not access control; services cohort is 6/6 on signed URLs.',
    },
    {
      id: 'a-replace-breaks-urls',
      rule: 'Replace/edit MUST NOT mint a silently different URL',
      why: 'Breaks every existing reference — URL preservation is the feature.',
    },
    {
      id: 'a-bulk-bypasses-auth',
      rule: 'Bulk operations MUST NOT bypass the single-op authorization path',
      why: 'Bulk delete is N times the single delete checks, not a cheaper path.',
    },
  ],
  sources: [
    'Cohort docs fetched live 2026-07-08 — full URL list in Docs/Research/feature-archetype-media-pilot.md (dos repo)',
  ],
};

export default MediaAssetLibrary;
