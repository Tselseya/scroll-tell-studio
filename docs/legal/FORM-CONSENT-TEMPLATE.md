# Form Consent and Consent-Record Template

**Template status:** Product copy and data-model guidance for legal review. Consent must be separated by purpose and must not be used to override contract, security, or platform requirements.

## Account registration

> I agree to the [Terms of Service](/terms) and acknowledge the [Privacy Policy](/privacy). I understand that ScrollTell will process my account information to create and secure my account and provide the service.

Required links must be visible beside the control. The checkbox must not be pre-selected. The required service-processing notice is separate from optional marketing or analytics consent.

## Optional analytics

> Allow optional analytics to help us understand aggregate product usage and improve ScrollTell. This is optional, is not required to use the service, and can be withdrawn from Privacy choices.

Default: off. The product must not load the analytics SDK before a valid opt-in where required.

## Connecting a platform account

> I authorize ScrollTell to connect to the selected platform using the permissions shown on the authorization screen. I understand what actions ScrollTell may take, that the platform’s terms and policies also apply, and that I can disconnect the account. ScrollTell will use the platform’s approved API flow where available.

For automated actions through X, the product must separately describe the automated actions, obtain express consent, and honor opt-out requests. For Meta products, the product must not offer unauthorized scripted website access or automated data collection.

## Publishing confirmation

> I confirm that this content, destination, account, timing, and media are correct. I have the rights and permissions required to publish the content, and I understand that the platform may reject, modify, remove, or enforce against the post.

This confirmation should be recorded with the content variant, destination, account, payload hash, user, time, policy version, and job identifier. Confirmation does not transfer responsibility for rights clearance or platform compliance to ScrollTell.

## Consent record fields

Store one row per purpose and event with:

- `id`
- `user_id`
- `organization_id`
- `purpose` such as `terms_acknowledgement`, `privacy_notice`, `analytics`, `marketing`, `platform_automation`, or `publish_confirmation`
- `choice` such as `granted`, `declined`, or `withdrawn`
- `policy_version`
- `source` such as `signup`, `settings`, `account_connect`, or `publish_review`
- `timestamp`
- `locale`
- `user_agent_hash` or other minimized evidence, if needed
- `supersedes_consent_id`, when applicable

The system must support viewing and withdrawing optional consent. Deletion of an account should preserve only the minimum consent evidence needed for legal defense and accountability, with a documented retention period.
