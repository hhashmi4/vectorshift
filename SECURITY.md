# Security policy

## Reporting a vulnerability

Do not disclose a suspected vulnerability in a public issue, discussion, or pull request.

Use GitHub's private vulnerability-reporting flow for this repository: open the **Security** tab, select **Advisories**, and choose **Report a vulnerability**. Until a monitored project security address is published, this is the canonical private reporting channel.

Include the affected commit or component, impact, reproduction steps, relevant configuration, and any suggested mitigation. Do not access another person's data, exhaust shared resources, test an external provider, or probe any deployment without explicit authorization.

If private reporting is unavailable, do not publish the details. Contact the repository owner through their GitHub profile and request a private reporting channel.

## Supported versions

VECTORSHIFT has no production release or deployed public service. Security fixes are made on a best-effort basis against the default branch until a versioned release and support policy is established. Historical commits and local experimental graph artifacts are not independently supported releases.

## Current security boundary

The checked-in application is a loopback-only engineering workspace. It does not provide production authentication, anonymous-user authorization, public routing, persistent scenarios, simulation compute, or cloud administration. Those capabilities remain gated by the [security threat model](docs/engineering/security.md) and roadmap review before deployment.

Third-party basemap, terrain, OpenStreetMap, and package-provider services are outside VECTORSHIFT's security program. Reports about those services should follow the provider's own policy unless the issue is caused by VECTORSHIFT's integration.

## Response expectations

Maintainers will acknowledge reports when the private channel is monitored, assess severity, coordinate remediation and disclosure, and credit reporters who wish to be named. No acknowledgement or resolution-time SLA is promised before the security function is staffed.

Security fixes should include regression coverage where safe, document any credential or dependency response, and avoid publishing exploit details before affected users can mitigate. The maintained threat model is [docs/engineering/security.md](docs/engineering/security.md).
