# Legacy automatic-fill conflict review

- Base: origin/develop 493c6dba (main 90fdd11d contains it); separate fix/legacy-conflict-review branch.
- Shared ConstraintConflictReview is mounted by the legacy modal and all three sidebar conflict paths. Change the shared display only.
- `conflictReview.explanation` is server conflict reasoning, while `violations` describe the proposed candidate. Label these separately; never infer baseline counts or subtract explanation prose from candidate values. The DTO has no baseline violation collection.
- Group repeated rule headings by rule ID and template. Keep every dated violation; text equality never proves equivalence. Reuse scheduleWarningRows only for its proven cross-family shortage equivalence.
- Staffing: show date, full ward shift code, proposed actual count, and required MIN/MAX/EXACT count. No ward-wide nurse list. Missing dates are explicitly unavailable.
- Consecutive work: show nurse, actual/limit, and full displayContext period before excess-only period/cells. Keep noncontiguous dates distinct. No invented period or person when metadata is absent.
- Show first five rows per rule with remaining rows in native details, retaining every row in accessible DOM. Keep expiry, double-submit guards, consent callbacks, settings and schedule state unchanged.
- Use synthetic fixtures and the further-anonymized incident 889 display projection (no production person/rule/shift identifiers, token or expiry). Actual evidence has three D dates, five E dates, STAFF_COUNT_BY_SHIFT EXACT4, plus CORE_MAX_CONTINUOUS_WORK actual7/expected5 with only Nov 1 reported in both period fields. Server explanation6 is limited engine lookback evidence, not a baseline count; never label this as a 6-to-7 worsening. Full cross-month period remains a backend evidence limitation. Verify focused regressions, typecheck/lint and real component rendering locally; no remote builds or deployment.

- Lower-bound metadata: optional ViolationDto.magnitudeIsLowerBound=true OR displayContext.runLengthIsLowerBound=true must render consecutive actual as at least/minimum, never as an exact run length. False/absent retains the exact-count display; reported dates remain unchanged.

- User copy names the consent reason and unmet proposal conditions directly; avoid explaining missing DTO comparisons. Use confirmed dates for the observed context, without inventing a baseline change.
