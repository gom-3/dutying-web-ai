# Cancellation state verification

Align sidebar cancellation with the loader and task entry: offer cancellation only for RUNNING operations with server background progress capability. Verify actual cancel API call, server-confirmed cancellation, unchanged draft and removal of the control. Verify completed, failed, cancelled, unknown, result-ready and legacy-running cases do not show an unsupported cancellation control.

Server PR338 implements durable cancellation and ignores late solver checkpoints; its active engine call drains rather than being force-killed. PR338 remains unmerged. Frontend verification is distinct from backend deployment.

## Verified

Frontend: 193 distinct tests passed across sidebar (180), operation history (4) and task entry (9); TypeScript and changed-product-file lint passed. The new completion test intentionally retains an obsolete cancellation callback and verifies the control still disappears.

Backend PR338 branch: ScheduleBackgroundJobsTest (2 tests) plus ScheduleConversationStoreTest.cancellationIsDurableAndLateCheckpointCannotApplyOrReopenIt (1 test) passed with Java 17/H2. This proves the implemented branch behavior; it is not evidence that the backend branch was merged/deployed.

| Before                                                                          | After                                                               | Why                                                 |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| Sidebar also offered cancellation for unknown/result-ready or legacy operations | Require server background capability and RUNNING state consistently | Avoid an unsupported cancel call                    |
| Task entry trusted a non-null callback regardless of current state              | Hide cancellation on completion even with a stale callback          | Completion cannot leave an actionable cancel button |
