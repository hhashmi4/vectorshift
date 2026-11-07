# Integration test boundary

Future tests here exercise contracts across deployables, including duplicate commands, revision races, run idempotency, cancellation/completion, lease fencing, object publication faults, and at-least-once delivery. They use local substitutes by default and never mutate production.
