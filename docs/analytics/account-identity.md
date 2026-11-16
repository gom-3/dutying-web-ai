# GA account identity

Production collection uses the built-in GA `user_id`: `web_<wardAdminAccountId>` for authenticated administrators and `app_<accountId>` for legacy nurse sessions. The two ID namespaces are distinct; identical numeric IDs do not prove a shared person. IDs are never a custom dimension and never contain names, emails, phone numbers or token contents.

The auth store updates identity synchronously before password/social outcomes and clears it on logout or demo sessions. Restored sessions identify after account validation. Preserve the existing GA acquisition fields and campaign parameters; OAuth provider is the login method, not the acquisition source.

`sign_up` keeps its existing product milestone. Native account creation is a separate `account_created` event supplied by the server creation flag; first_visit/first_open remain first-use metrics. Historical unidentified events are not backfilled or assigned by matching timestamps.

For an account audit, copy the GA User-ID from the account monitoring detail and inspect GA user explorer. Account-level exports and joins to deletion/retention state require BigQuery event export. Export is not established merely by deploying this code. On 2026-11-16, a daily export of all three streams to `dutying-ai` in `asia-northeast3`, without advertising IDs, was prepared but not submitted; streaming was unavailable without billing. Confirm the saved link and received tables before treating it as live.
