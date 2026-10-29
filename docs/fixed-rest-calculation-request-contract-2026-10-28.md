# Fixed monthly calculation is not an implicit exact upper bound

The ward UI chooses a monthly calculation baseline. It does not separately ask
that no regular worker may exceed that number. Stop automatically sending
exactForRegularWorkers=true solely because targetMode=fixed. Minimum days,
adjustments, carry, counted types and per-nurse explicit policies are unchanged.
Explicit API exact=true and HARD individual EXACT rules remain authoritative.

The source182 contrast copies the archived request and removes only the
UI-generated exact flag. It is a corrected request transformation, not an exact
raw replay: dedicated N16/O14; regular OFF histogram 9:1,10:5,11:1,12:3;
regular extra OFF16, daily D3/E3/N1 exact, staff shortage/excess0, locks30 intact,
annual-leave-type cells0, regular N14 total and max consecutive N3 (previous4).
No N15/max3 condition or objective reordering is added.

Real UI consent exposed another transport mismatch: a GENERATE/REBUILD_UNLOCKED
candidate was selected without fillPolicy and became EMPTY_ONLY on the server.
Preserve the originating fill mode when selecting the cached candidate. Test
both generation modes and ADJUST with the existing selection interaction.

Read original night-run proof from public engineResult.conflictEvidence. Spring
keeps solver write-only and exposes a recognized-field projection; a frontend
fixture with solver alone does not represent its public HTTP response.

Annual leave is accounted by shift type and explicit day exceptions, not by
exceeding the rest baseline. The source ward's enabled annual settings have no
unit overrides: OFF defaults to0 and ANNUAL_LEAVE to1. No ledger is changed by
an autofill draft; existing confirmation performs the ledger sync. Validate the
unchanged OFF0/annual1 and configured OFF unit behavior with focused tests.

Source215 retains its contradictory explicit HARD night rules. It must use the
existing CONSENT_REQUIRED review/selection flow, show original and candidate
violations, and pass Spring's independent candidate verification before a
cached selection can apply. The sender change does not authorize a concession,
relax explicit exact/locks/availability or publish a roster. Reuse isolated QA
ward587/team961 only; production data remains unchanged.
