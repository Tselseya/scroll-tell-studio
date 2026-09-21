# ScrollTell Studio Multi-Tenant Database Architecture

## Scope and status

This document defines the production architecture for the centrally hosted SaaS. The current local development database remains SQLite, but the hosted product should use PostgreSQL with Drizzle migrations and database-enforced tenant isolation. The schema changes already introduce users, organizations, memberships, and organization ownership on workspaces so the product can move toward this model without treating a single-user database as a safe hosted architecture.

## Tenant model

A **user** is an authenticated human identity. An **organization** is the security and billing tenant. An organization can have one or more members with `owner`, `admin`, or `member` roles. A **workspace** is a content environment inside an organization. Every content, media, provider, account, publishing, job, audit, consent, and billing record must belong to exactly one organization, either directly or through a workspace.

The server must derive `organizationId` from the authenticated session and membership lookup. It must never accept a client-supplied organization identifier as authority. A request may include a workspace identifier only after the server verifies that the workspace belongs to the authenticated organization.

## Core tables

The production schema should include the following groups:

| Group | Tables | Isolation requirement |
|---|---|---|
| Identity | `users`, `sessions`, `organizations`, `organization_members` | Membership is checked on every request. Sessions are revocable. |
| Workspace | `workspaces`, `content_items`, `content_variants`, `media_assets` | Each row carries `organization_id`; workspace ownership is also checked. |
| Integrations | `ai_providers`, `connected_accounts`, `oauth_tokens`, `browser_profiles` | Secrets are encrypted or held in a managed secret store; tokens are never returned to clients. |
| Execution | `jobs`, `job_attempts`, `publish_attempts` | Workers receive a tenant-scoped job envelope and re-check ownership before execution. |
| Compliance | `consent_records`, `data_subject_requests`, `audit_events`, `security_incidents` | Records are append-only where practical and have retention controls. |
| Commercial | `subscriptions`, `invoices`, `entitlements` | Billing data is tenant-scoped and access is restricted to owners/admins. |

## Isolation strategy

Use defense in depth. The application layer must apply an organization scope to every repository method. The database layer should use PostgreSQL row-level security (RLS) as a second control. A request-scoped database transaction sets a trusted tenant context such as `app.organization_id` after authentication and membership verification. RLS policies then require the row's `organization_id` to match that context.

The application database role must not be a table owner that can bypass RLS during ordinary requests. Migrations may use a separate privileged role. Background workers must not use a global unrestricted connection for tenant data; they should consume a job containing an organization identifier, open a scoped transaction, and re-check the job and all referenced records before doing work.

Every query helper should require a scope object:

```ts
type TenantScope = {
  organizationId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
};

function contentRepository(scope: TenantScope) {
  return {
    list: () => db.select().from(contentItems)
      .where(eq(contentItems.organizationId, scope.organizationId)),
  };
}
```

A repository function that can query tenant data without a scope should be treated as a security defect. Avoid raw SQL in request handlers. If raw SQL is necessary, it must include a tenant predicate and a test proving that cross-tenant rows are inaccessible.

## Secrets and third-party accounts

OAuth access and refresh tokens must not be stored in ordinary content tables. Store them in a dedicated encrypted secret service or an encrypted column protected by a key-management system. Keep only a non-sensitive `secretRef`, token metadata, scopes, expiry, and connection status in the application database. Browser automation profiles must be isolated per organization and account, encrypted at rest, and never shared between tenants.

The application must request the minimum platform scopes necessary. Disconnecting an account must revoke the provider token where supported, delete or disable the local secret reference, cancel related jobs, and append an audit event.

## Media isolation

Use object storage prefixes or buckets that include the organization identifier, such as `org/{organizationId}/media/{assetId}`. Generate short-lived signed URLs after authorization. Do not expose predictable object paths. Virus scanning, MIME validation, size limits, and content-disposition controls are required before serving uploaded files.

## Compliance data model

Store a versioned consent record with `user_id`, `organization_id` when applicable, policy version, purposes, categories, choice, timestamp, source, locale, and user-agent metadata. Store separate records for required service processing and optional analytics/marketing consent. Do not use one checkbox to bundle unrelated purposes.

Data-subject requests need a tracked workflow with identity verification, scope, legal hold checks, processor coordination, response deadline, and completion evidence. Deletion must be soft-delete plus an asynchronous purge job where immediate deletion would break audit or legal-retention obligations.

## Operational controls

The hosted service should require database backups, point-in-time recovery, restore tests, audit logging, secret rotation, dependency scanning, rate limiting, account lockout protections, CSRF protection where cookie sessions are used, and a documented incident-response plan. Tenant isolation must be tested in CI with at least two organizations and adversarial cross-tenant identifiers.

The public SaaS must not launch until the production provider, authentication system, data-processing agreements, DPO/contact workflow, retention schedule, and incident-response ownership are chosen and documented.
