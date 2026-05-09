# Bug report: `claude-dev-digest` over-credits long non-user-pause gaps

> Handoff brief for a coding agent working on the **generator** (`claude-dev-digest`).
> The agent has access to the raw Claude Code session JSONL files, so examples cite session IDs and timestamps it can resolve directly.

## Summary

The v1.2.0 active-duration calculation has a pair of related defects that produce wildly wrong `activeDurationMin` values (and misleading `segments[]` entries) when a session contains long real-world pauses that happen *not* to fall between an assistant message and a user message.

Two problems, ordered by severity:

1. **Primary (high-severity):** Only `user_pause` gaps are capped by `--user-pause-cap-min`. `tool_runtime` and `inference` gaps are always fully credited, with no cap and no sanity check. A gap of arbitrary length classified as `tool_runtime` or `inference` — even 2+ real-world days — is trusted 100% as active time and is not emitted in `gaps[]`. A downstream consumer has no way to see it exists.

2. **Secondary (labeling/scope):** `Segment.messageCount` counts *every* user-role and assistant-role record in the segment, including synthetic `tool_result` records and `tool_use` records. It is not a count of "messages" in the human/conversational sense. Either the field should be renamed / split into "records" vs "user-typed turns", or the description in `report.schema.json` should make explicit that it's a raw-record count. (This isn't a correctness bug; it just misleads consumers. Noting it here because it came up in the same investigation.)

## Evidence — reproducer session

**Session:** `140a5ddb-96c5-4197-8462-39e5de291b59`

As emitted by the generator:
```
createdAt:         2026-04-16T14:44:07.164Z
lastActivityAt:    2026-04-19T14:15:15.809Z   (~71h 31m wall-clock)
durationMin:       4291.1
activeDurationMin: 4148.3                     (~69h 8m "active" — obviously wrong)
idleSec:           8568
userPauseCount:    13
longestUserPauseSec: 9168                     (~2h 33m)
needsActiveReview: true
activeReviewReason: "long_single_pause"

gaps[]:      1 entry
  [0] 2026-04-16T15:20:26Z → 2026-04-16T17:53:14Z
      kind: "user_pause", sec: 9168, creditedSec: 600

segments[]:  2 entries
  [0] 2026-04-16T14:44:07Z → 2026-04-16T15:20:26Z    sec: 2179.6,   messageCount: 298
  [1] 2026-04-16T17:53:14Z → 2026-04-19T14:15:15Z    sec: 246121,   messageCount: 100
```

The second segment claims 100 messages over **~68 hours** of "continuous activity burst." That's physically impossible — a human doesn't message every ~40 minutes around the clock for three days.

**What actually happened, per the raw JSONL:** sorting every timestamp in `userMessages` + `assistantTexts` and computing consecutive deltas reveals one enormous gap hidden *inside* segment 2:

```
from: 2026-04-16T18:11:33.456Z   (assistant record)
to:   2026-04-19T13:50:53.106Z   (assistant record)
sec:  243559.65  (~67h 39m)
```

Note both endpoints are **assistant** records. This is almost certainly a `tool_use` → `tool_result` gap: the assistant requested a tool call near EOD Apr 16, the user walked away, and only approved (or the tool only completed / resumed) ~3 days later. Because the gap sits between "assistant (tool_use)" and "user (tool_result) → assistant (response)", the classifier sees a tool-runtime context and labels the whole ~67-hour span as `tool_runtime` (or possibly `inference`, same effect). Neither kind is capped or emitted, so:

- `activeDurationMin` silently absorbs all 67 hours → ends up at ~69h 8m
- `gaps[]` never contains it → consumers cannot render or warn about it
- `segments[]` merges across it → segment 2's `sec` (246121s) and `messageCount` (100) are both misleading: the segment is not a single activity burst, it's two real bursts glued by a 67-hour silent gap

Arithmetic confirming that the generator is "stripping" only the 2h33m `user_pause`:
```
durationMin - activeDurationMin = 4291.1 - 4148.3 = 142.8 min = 8568 s  == idleSec ✓
idleSec = gap.sec - gap.creditedSec = 9168 - 600 = 8568 ✓
```
The 67h tool_runtime/inference contributes `0` to `idleSec` and is not in `gaps[]`. That's the bug.

## Hypothesized root cause

The gap classifier decides `kind` purely from the roles/record-types on either side of the gap:
- prev=assistant(tool_use), next=user(tool_result)  → `tool_runtime`
- prev=user(tool_result),   next=assistant          → `inference`
- prev=assistant(text),     next=user(text)         → `user_pause`
- within a turn                                      → `same_turn`

This is fine when tools execute in seconds and inference takes a few seconds, but there is no magnitude-based sanity check. A multi-hour tool_runtime is almost always "user walked away mid-approval," i.e. semantically a user_pause. The classification dominates before the cap is applied, so the cap (which is only wired into `user_pause`) never gets a chance to contain the damage.

## Suggested fix directions (pick what fits the design)

In rough order of simplicity, any one of these closes the primary bug:

1. **Apply the cap to all gap kinds.** Cap `tool_runtime` and `inference` at the same `--user-pause-cap-min` (or a separate, larger-but-finite cap like `--tool-runtime-cap-min`, default e.g. 5 min). Emit over-cap entries into `gaps[]` just like `user_pause`.
2. **Promote long gaps to `user_pause` regardless of surrounding record roles.** E.g. any gap over `max(user_pause_cap, 30 min)` is reclassified as `user_pause` before crediting. Rationale: a human not responding for >30 min is a pause, whatever the surrounding records look like.
3. **Emit every over-threshold gap into `gaps[]`**, regardless of kind, even if fully credited. Consumers could then render and warn even if you don't want to change the credit math. (This is the minimum change that would have prevented the visualizer from showing a 68-hour "active burst.")

Whichever route is picked, also:

- **Split segments on any over-cap gap**, not just over-cap `user_pause`. Right now `segments[]` is documented as "contiguous activity bursts split by over-cap gaps" but only user_pause gaps actually split; a long tool_runtime glues two bursts together and falsifies the segment span and messageCount.
- Consider adding an `idleBreakdownSec` on the session (idle per kind), so `idleSec` isn't the only idle signal and consumers can tell "we threw away 67 hours of tool_runtime" from "we threw away 2 hours of user_pause."

## Reproducer sessions to debug against

Both are in the reference report fed into the visualizer (same user, window includes both):

- **Primary:** `140a5ddb-96c5-4197-8462-39e5de291b59` — the 67-hour tool_runtime/inference gap described above. Check the raw JSONL between `2026-04-16T18:11:33Z` and `2026-04-19T13:50:53Z` and look at how it's currently being classified. Expected fix: that span should either be capped (adding ~67h to `idleSec`) or surfaced in `gaps[]`.
- **Secondary (labeling only, lower urgency):** `514e1eb6-528e-4cab-bb43-24266b8b730c` — 23-min session, `userMsgCount=28`, `assistantMsgCount=38`, single segment with `messageCount=66`. The user only typed ~4–5 real prompts; the other 23 "user records" are synthetic `tool_result`s (21 tool invocations per `toolCounts`). Not a correctness bug, but `Segment.messageCount`'s description in `report.schema.json` should make clear it's a raw-record count, or the field should be renamed / supplemented with a human-turn count.

## Acceptance criteria for the fix

For session `140a5ddb-96c5-4197-8462-39e5de291b59` with default caps, after regenerating:

- `activeDurationMin` should be roughly **60–80 minutes** (sum of the two real bursts ~36m + short re-engagement around 17:53–18:11 on Apr 16 + the short tail on Apr 19 around 13:50–14:15), **not** 4148 min.
- The 67h gap between `2026-04-16T18:11:33Z` and `2026-04-19T13:50:53Z` should be visible to downstream consumers — either present in `gaps[]` (any kind), or split the segments such that segment 2 is at least two entries.
- `idleSec` + credited time should still sum to `durationMin * 60` (conservation).
- `segments[]` should no longer contain any entry whose `sec / messageCount` ratio implies an implicit multi-hour gap (a good unit-test assertion: flag any segment where `sec > messageCount * some_reasonable_per_record_cap`, e.g. 5 min).
