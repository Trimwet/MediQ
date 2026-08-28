# Graph Report - C:\Users\MAFUYAI\Documents\MediQ  (2026-08-28)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 7 nodes · 7 edges · 2 communities (1 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 126 input · 14 output

## Graph Freshness
- Built from commit: `b71af318`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Onboarding Task Checklist
- index.tsx

## God Nodes (most connected - your core abstractions)
1. `GettingStartedChecklist()` - 2 edges
2. `Task` - 1 edges
3. `TASKS` - 1 edges
4. `CANCELLABLE_STATUSES` - 1 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (2 total, 1 thin omitted)

### Community 0 - "Onboarding Task Checklist"
Cohesion: 0.50
Nodes (3): GettingStartedChecklist(), Task, TASKS

## Knowledge Gaps
- **3 isolated node(s):** `Task`, `TASKS`, `CANCELLABLE_STATUSES`
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `Task`, `TASKS`, `CANCELLABLE_STATUSES` to the rest of the system?**
  _3 weakly-connected nodes found - possible documentation gaps or missing edges._