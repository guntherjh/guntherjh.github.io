# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| --------------------------- | --------------------- | ----------------------------------------- |
| `needs-triage`               | `needs-triage`         | Maintainer needs to evaluate this issue   |
| `needs-info`                 | `needs-info`           | Waiting on reporter for more information  |
| `ready-for-agent`            | `ready-to-implement`   | Fully specified, ready for an AFK agent   |
| `ready-for-human`            | `ready-to-implement`   | Requires human implementation             |
| `wontfix`                    | `wontfix`               | Will not be actioned                      |

`ready-for-agent` and `ready-for-human` are deliberately collapsed into one label, `ready-to-implement` — this repo doesn't distinguish agent-workable from human-only tickets by label. If that distinction ever matters (e.g. a ticket genuinely needs a human judgment call), say so in the ticket body rather than relying on the label.

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.
