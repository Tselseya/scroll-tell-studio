# Compliance and Launch-Risk Register

**Status:** Engineering and product risk review; not a legal opinion. A Philippines-qualified privacy and commercial lawyer should review the final service, entity, contracts, data flows, and launch jurisdictions.

## Current code audit

The repository currently contains no analytics SDK, advertising pixel, cookie-consent vendor, third-party embed, remote font import, or social widget. This means no optional tracking is currently implemented in the code inspected for this review. The hosted deployment must be scanned separately because infrastructure, CDN, authentication, billing, error monitoring, and support vendors can add tracking outside the repository.

The current dashboard contains the first wireframes for account authorization, publishing review, and privacy choices. These are not yet connected to authentication, real OAuth, a consent database, or production policy URLs.

## High-risk items before public launch

| Area | Risk | Required control | Status |
|---|---|---|---|
| Tenant isolation | A missing organization predicate could disclose one customer’s content to another. | PostgreSQL RLS, scoped repositories, adversarial cross-tenant tests, worker re-checks. | Architecture documented; not production complete. |
| Credentials | OAuth tokens or browser profiles could expose publishing accounts. | Secret manager or encrypted storage, minimal scopes, rotation, revocation, redacted logs. | Not implemented. |
| Platform automation | X says non-API website scripting can lead to permanent suspension. Meta says programmatic access must use Platform APIs unless it gives prior written permission. | Official APIs by default; disable browser automation for prohibited platforms; obtain written permission before any exception. | Policy gate designed; adapters not implemented. |
| Privacy controller obligations | A public SaaS processing global data needs a documented controller/processor role, DPO, records, notices, retention, and incident process. | Name the legal entity, appoint DPO, maintain records of processing, DPIA/PIA, processor agreements, and rights workflow. | Not implemented. |
| Breach response | Philippine NPC guidance describes notification within 72 hours and additional reporting requirements; GDPR may require supervisory-authority notification within 72 hours. | Incident runbook, clock ownership, evidence preservation, notification templates, processor escalation. | Not implemented. |
| International transfers | Global hosting and AI/social providers may transfer data across borders. | Vendor map, transfer mechanism, SCCs or other safeguards where applicable, subprocessor list, notice. | Placeholder only. |
| Cookies and analytics | Non-essential storage and analytics generally require affirmative consent in relevant regimes. | Inventory, block before consent, equal accept/reject, withdrawal, consent logs. | Current repo has no analytics; consent UI is wireframe. |
| Content and copyright | Users may upload media, music, fonts, logos, likenesses, or AI output without rights. | Rights attestation, takedown process, repeat-infringer policy, provenance fields, user-facing warnings. | Not implemented. |
| Accessibility | Forms and modals can fail contrast, keyboard, focus, labels, error identification, or target-size requirements. | WCAG 2.2 AA audit with keyboard and screen-reader tests. | Initial labels and dialog semantics added; audit pending. |
| Business identity | Users need to know who operates the service and where to send privacy, legal, and support notices. | Publish legal entity, address, email, DPO contact, VAT/tax and pricing disclosures where applicable. | Placeholder only. |

## Additional legal and operational questions

Philippine law should be reviewed for the Data Privacy Act of 2012 and its implementing rules, electronic transactions, consumer protection, tax and invoicing obligations, cybercrime and security obligations, and any registration requirements applicable to the entity and processing systems. The DPA’s application depends on the actual processing and role of the business, not merely the wording of a policy.

Global availability can trigger additional laws based on user location, establishment, targeting, monitoring, age, and product features. GDPR coverage must be assessed for EU/EEA users. UK users may trigger UK GDPR and PECR-style cookie rules. California and other United States state laws may apply depending on thresholds and business activity. Other jurisdictions may require local notices, transfer controls, representative arrangements, or consumer rights.

The service should not market itself as “GDPR compliant” or “fully compliant” until the real processing inventory, vendors, contracts, controls, evidence, and independent review support that claim.

## Design and accessibility checklist

Use a visible page title and landmarks. Keep all modal controls keyboard reachable. Move focus into a dialog, return focus to the triggering control on close, and close with Escape without trapping users. Provide programmatic labels, descriptions, error messages, and status announcements. Do not rely on color alone. Target at least WCAG 2.2 AA contrast values, including 4.5:1 for ordinary text and 3:1 for large text. Make button labels describe the action, such as “Connect X account,” “Review and queue post,” “Reject optional analytics,” and “Save privacy choices.”

## Platform-specific rule

Do not ship a generic “browser automation fallback” that scripts social websites. The implementation must maintain a per-platform policy registry. For X, the registry should mark website scripting as prohibited and route publishing through the approved API only. For Meta products, the registry should require the relevant Platform API and permissions and block automated collection or action outside the API unless written permission is documented. A browser worker can exist as an internal extension point, but it must refuse execution when the platform policy gate says it is not permitted.

## References

[1]: https://privacy.gov.ph/data-privacy-act/ "Republic Act 10173 - Data Privacy Act of 2012"
[2]: https://privacy.gov.ph/appointing-a-data-protection-officer/ "National Privacy Commission guidance on appointing a Data Protection Officer"
[3]: https://privacy.gov.ph/exercising-breach-reporting-procedures/ "National Privacy Commission breach reporting procedures"
[4]: https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02016R0679-20160504 "Regulation (EU) 2016/679 - consolidated text"
[5]: https://www.edpb.europa.eu/documents/guideline/guidelines-052020-on-consent-under-regulation-2016679_en "EDPB Guidelines 05/2020 on consent"
[6]: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/ "ICO guidance on cookies and similar technologies"
[7]: https://www.w3.org/TR/WCAG22/ "Web Content Accessibility Guidelines (WCAG) 2.2"
[8]: https://help.x.com/en/rules-and-policies/x-automation "X automation rules"
[9]: https://developers.facebook.com/documentation/development/terms-and-policies/automated-data-collection "Meta automated data collection policy"
[10]: https://developers.facebook.com/documentation/threads "Threads API documentation"
