# Cross-component tests

- `integration`: API/coordinator/compute/object protocol and injected-failure tests.
- `e2e`: browser journeys, accessibility, conflict, reconnect, quota, and explanation behavior.
- `fixtures`: minimal synthetic or redistributable inputs with provenance and expected schemas.

Unit tests live beside their component. Cross-component tests must be hermetic by default, bounded in resources, deterministic where semantics require it, and explicit when an opt-in provider integration is used. No full-city dataset belongs here.
