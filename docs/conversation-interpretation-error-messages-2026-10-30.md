# Interpretation failure messages

Conversation 26 reached the model and failed in edit validation. An upstream 422 must not be described as interpreter connectivity or an assumed temporary outage. Use SCHEDULE_INTERPRET_REJECTED for this path and INVALID_CONDITION_EDIT for a safe FAILED preview. State the stage, explain that this request did not start schedule computation or modify the schedule, and offer the same-request retry. Do not imply the user must change their wording. Keep raw upstream errors private. General interpreter errors retain neutral wording without diagnosing a network outage.

Keep the existing UI layout, provide a stage-specific failure title, and use matching Korean/English/Japanese strings for API failures and failed previews. Backend must accept a failed no-edit response only with identical stored conditions/pending question and no execution authority.

Validation: local UI failure mapping and semantic review suites: 69 passed; TypeScript project type-check passed. Backend client/journey/state-validator tests: 32 passed; LLM conversation-state tests: 19 passed. No live API calls, DB migrations or deployments.
