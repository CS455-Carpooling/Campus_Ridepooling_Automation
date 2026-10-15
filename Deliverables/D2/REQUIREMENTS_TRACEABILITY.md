# D2 Requirements Traceability

This matrix was rebuilt from a fresh, source-only review of the repository.
Only actual implementation and executable configuration files are used as
traces. Test files, fixtures, snapshots, documentation, binary artifacts, and
lockfiles are not evidence in this matrix. A requirement is listed only when
the reviewed implementation directly provides behavior, validation, schema
constraints, or an executable integration for it.

## Source-only review record

| Review scope | Files read completely | Lines read | Unread paths |
|---|---:|---:|---:|
| `apps/web/src` runtime source | 253 | 33,648 | 0 |
| `apps/web/db/schema.sql` | 1 | 1,531 | 0 |
| `apps/web/scripts` | 2 | 113 | 0 |
| `apps/web` executable/configuration files | 9 | 783 | 0 |
| Root executable/configuration files and workflows | 10 | 314 | 0 |
| **Total implementation/configuration review** | **275** | **36,389** | **0** |

The audit explicitly excluded 202 tracked test, fixture, and snapshot files,
one lockfile, 78 binary/compiled artifacts, and documentation/design files.
No excluded file is cited below.

## Rider functional requirements

Source: [Rider functional requirements](../D1/Requirements%20Engineering/users/rider/02_functional_requirements.md).

| Requirement | Implementation trace |
|---|---|
| `FR-RD-01.5` | `apps/web/src/lib/suspensions.ts`; `apps/web/src/lib/join-requests.ts`; `apps/web/src/lib/ride-chat.ts` |
| `FR-RD-02.4`, `FR-RD-02.5`, `FR-RD-02.7` | `apps/web/src/lib/profile-data.ts`; `apps/web/src/lib/ride-view.ts`; `apps/web/src/lib/ride-search-rules.ts`; `apps/web/src/lib/ride-search.ts`; `apps/web/src/app/profile/page.tsx` |
| `FR-RD-03.2`, `FR-RD-03.3`, `FR-RD-03.6` | `apps/web/src/lib/ride-search.ts`; `apps/web/src/lib/ride-search-rules.ts`; `apps/web/src/lib/ride-matcher.ts`; `apps/web/src/app/(app)/rides/page.tsx`; `apps/web/src/app/(app)/rides/results/page.tsx` |
| `FR-RD-05`, `FR-RD-05.1`-`FR-RD-05.7` | `apps/web/src/lib/join-requests.ts`; `apps/web/src/app/api/rides/[id]/requests/route.ts`; `apps/web/src/app/api/rides/[id]/requests/[requestId]/route.ts`; `apps/web/db/schema.sql` |
| `FR-RD-06.2`, `FR-RD-06.4`, `FR-RD-06.8`, `FR-RD-06.10` | `apps/web/src/lib/ride-view.ts`; `apps/web/src/lib/trip-rules.ts`; `apps/web/src/app/api/rides/[id]/check-in/route.ts`; `apps/web/src/app/api/rides/[id]/trip/route.ts`; `apps/web/src/components/rides/TripPanel.tsx` |
| `FR-RD-07.2`, `FR-RD-07.3`, `FR-RD-07.5` | `apps/web/src/lib/ride-chat.ts`; `apps/web/src/lib/ride-chat-realtime.mjs`; `apps/web/src/app/api/rides/[id]/chat/route.ts`; `apps/web/src/components/rides/RideChat.tsx` |
| `FR-RD-08`, `FR-RD-08.1`, `FR-RD-08.3`-`FR-RD-08.5` | `apps/web/src/lib/fare.ts`; `apps/web/src/lib/payment-rules.ts`; `apps/web/src/lib/payment-settlement.ts`; `apps/web/src/components/rides/SettlementPanel.tsx`; `apps/web/db/schema.sql` |
| `FR-RD-09.5`, `FR-RD-09.6` | `apps/web/src/lib/ride-chat.ts`; `apps/web/src/app/api/rides/[id]/chat/route.ts`; `apps/web/src/app/api/rides/[id]/complaints/route.ts` |
| `FR-RD-10`, `FR-RD-10.1`-`FR-RD-10.4` | `apps/web/src/lib/trip-itinerary.ts`; `apps/web/src/lib/trip-rules.ts`; `apps/web/src/app/api/rides/[id]/trip/route.ts`; `apps/web/src/app/api/rides/[id]/check-in/route.ts` |
| `FR-RD-12`, `FR-RD-12.1`-`FR-RD-12.4` | `apps/web/src/lib/rating-rules.ts`; `apps/web/src/lib/ride-ratings.ts`; `apps/web/src/lib/rating-summary.ts`; `apps/web/src/components/rides/RatingForm.tsx`; `apps/web/src/components/profile/RatingSummary.tsx` |
| `FR-RD-13`, `FR-RD-13.1`-`FR-RD-13.6` | `apps/web/src/lib/complaint-rules.ts`; `apps/web/src/lib/complaint-queries.ts`; `apps/web/src/app/api/rides/[id]/complaints/route.ts`; `apps/web/src/app/(app)/complaints/page.tsx`; `apps/web/src/components/complaints/ComplaintForm.tsx` |
| `FR-RD-14.1` | `apps/web/src/app/api/notifications/route.ts`; `apps/web/src/components/notifications/NotificationsCentre.tsx`; `apps/web/src/lib/notification-types.ts`; `apps/web/src/lib/notification-realtime.mjs` |
| `FR-RD-15`, `FR-RD-15.1`-`FR-RD-15.5` | `apps/web/src/lib/sos-rules.ts`; `apps/web/src/lib/sos.ts`; `apps/web/src/app/api/rides/[id]/sos/route.ts`; `apps/web/src/app/api/sos/[id]/route.ts`; `apps/web/src/components/rides/SosPanel.tsx`; `apps/web/db/schema.sql` |
| `FR-RD-16.1`, `FR-RD-16.2` | `apps/web/src/lib/home-data.ts`; `apps/web/src/components/home/RideHistoryList.tsx`; `apps/web/src/app/api/profile/export/route.ts`; `apps/web/src/app/api/profile/delete/route.ts` |

## Rider AI-agent requirements

Source: [Rider AI-agent requirements](../D1/Requirements%20Engineering/users/rider/04_ai_agent_requirements.md).

| Requirement | Implementation trace |
|---|---|
| `AI-RD-02`, `AI-RD-04`, `AI-RD-05` | `apps/web/src/lib/ai/chatbot.ts`; `apps/web/src/lib/ai/chatbot-tools.ts`; `apps/web/src/lib/ai/preference-proposals.ts`; `apps/web/src/app/api/chatbot/confirm-preference/route.ts` |
| `AI-RD-08`, `AI-RD-09`, `AI-RD-10` | `apps/web/src/app/(app)/chatbot/page.tsx`; `apps/web/src/components/chatbot/ChatbotInterface.tsx`; `apps/web/src/lib/ai/chatbot.ts`; `apps/web/src/lib/ai/chatbot-gemini.ts`; `apps/web/src/lib/ai/chatbot-tools.ts`; `apps/web/src/lib/ai/chatbot-session.ts` |
| `AI-RD-12` | `apps/web/src/lib/ai/chatbot-audit.ts`; `apps/web/src/lib/ai/recommendation-audit.ts`; `apps/web/db/schema.sql` |
| `AI-RD-15` | `apps/web/src/lib/ai/recommendation-pipeline.ts`; `apps/web/src/lib/ai/recommendations.ts`; `apps/web/src/lib/ai/gemini-ranking.ts`; `apps/web/src/lib/ai/validate-ranking.ts`; `apps/web/src/app/api/rides/recommendations/route.ts` |

## Ride Owner functional requirements

Source: [Ride Owner functional requirements](../D1/Requirements%20Engineering/users/ride_owner/02_functional_requirements.md).

| Requirement | Implementation trace |
|---|---|
| `FR-RO-03.2` | `apps/web/src/lib/ride-rules.ts`; `apps/web/src/app/api/rides/route.ts`; `apps/web/src/components/rides/CreateRideForm.tsx` |
| `FR-RO-06.2` | `apps/web/src/app/api/rides/[id]/lock/route.ts`; `apps/web/src/components/rides/RideManagementControls.tsx` |
| `FR-RO-09`, `FR-RO-09.1`-`FR-RO-09.4` | `apps/web/src/lib/trip.ts`; `apps/web/src/lib/trip-rules.ts`; `apps/web/src/app/api/rides/[id]/arrivals/route.ts`; `apps/web/src/app/api/rides/[id]/complete/route.ts`; `apps/web/src/components/rides/ArrivalControls.tsx`; `apps/web/src/components/rides/TripActionButton.tsx` |
| `FR-RO-10`, `FR-RO-10.1`-`FR-RO-10.3` | `apps/web/src/lib/trip.ts`; `apps/web/src/lib/trip-rules.ts`; `apps/web/src/app/api/rides/[id]/arrivals/route.ts`; `apps/web/src/app/api/rides/[id]/trip/route.ts` |
| `FR-RO-12`, `FR-RO-12.1`, `FR-RO-12.2` | `apps/web/src/lib/ride-ratings.ts`; `apps/web/src/lib/rating-rules.ts`; `apps/web/src/app/api/rides/[id]/ratings/route.ts`; `apps/web/src/components/rides/RideReview.tsx` |
| `FR-RO-13.2` | `apps/web/src/components/rides/SosPanel.tsx`; `apps/web/src/app/api/rides/[id]/sos/route.ts`; `apps/web/src/lib/sos-rules.ts` |

## Operations Admin and system requirements

Source: [Operations Admin requirements](../D1/Requirements%20Engineering/users/admin/Operations_Admin_Requirements.md).

| Requirement | Implementation trace |
|---|---|
| `OA-FR-01`, `OA-FR-02` | `apps/web/src/lib/admin-config.ts`; `apps/web/src/app/api/admin/vehicle-types/route.ts`; `apps/web/src/app/api/admin/vehicle-types/[id]/route.ts`; `apps/web/src/components/admin/config/VehicleTypesEditor.tsx` |
| `OA-FR-05`, `OA-FR-06` | `apps/web/src/lib/admin-config.ts`; `apps/web/src/app/api/admin/locations/route.ts`; `apps/web/src/app/api/admin/locations/[id]/route.ts`; `apps/web/src/components/admin/config/PlacesEditor.tsx` |
| `OA-FR-11` | `apps/web/src/lib/admin-config.ts`; `apps/web/src/app/api/admin/external-fares/route.ts`; `apps/web/src/components/admin/config/FareRangesEditor.tsx` |
| `OA-FR-16`, `OA-FR-18`, `OA-FR-20`, `OA-FR-21`, `OA-FR-23`, `OA-FR-28` | `apps/web/src/lib/admin-complaint-queries.ts`; `apps/web/src/app/api/admin/complaints/[id]/route.ts`; `apps/web/src/app/admin/complaints/page.tsx`; `apps/web/src/app/admin/complaints/[id]/page.tsx`; `apps/web/src/app/api/admin/chat-reports/route.ts` |
| `OA-FR-34`, `OA-FR-42` | `apps/web/src/lib/enforcement.ts`; `apps/web/src/lib/suspensions.ts`; `apps/web/src/app/api/admin/riders/[id]/warnings/route.ts`; `apps/web/src/app/api/admin/riders/[id]/suspensions/route.ts`; `apps/web/src/app/api/admin/riders/[id]/reactivation/route.ts` |
| `SYS-FR-09`, `SYS-FR-12`, `SYS-FR-13`, `SYS-FR-17`, `SYS-FR-19` | `apps/web/src/lib/admin-auth.ts`; `apps/web/src/lib/admin-actions.ts`; `apps/web/src/lib/admin-activity.ts`; `apps/web/src/app/api/admin/vehicle-types/route.ts`; `apps/web/src/app/api/admin/locations/route.ts`; `apps/web/db/schema.sql` |
| `SYS-FR-24`-`SYS-FR-27` | `apps/web/src/lib/admin-incident-queries.ts`; `apps/web/src/app/admin/incidents/page.tsx`; `apps/web/src/app/admin/incidents/[id]/page.tsx`; `apps/web/src/app/api/admin/incidents/open/route.ts`; `apps/web/src/app/api/admin/incidents/[id]/route.ts`; `apps/web/db/schema.sql` |
| `SYS-FR-30`, `SYS-FR-31`, `SYS-FR-35`, `SYS-FR-37`-`SYS-FR-39` | `apps/web/src/lib/admin-rider-queries.ts`; `apps/web/src/lib/admin-recommendation-audits.ts`; `apps/web/src/app/admin/riders/page.tsx`; `apps/web/src/app/admin/riders/[id]/page.tsx`; `apps/web/src/app/admin/rides/[id]/page.tsx` |
| `SYS-FR-44`, `SYS-FR-45` | `apps/web/src/lib/complaint-ai.ts`; `apps/web/src/lib/ai-enforcement.ts`; `apps/web/src/app/api/admin/complaints/[id]/ai-decision/route.ts`; `apps/web/src/app/admin/ai-recommendations/page.tsx`; `apps/web/src/app/admin/ai-decisions/page.tsx` |
| `SYS-NFR-01`, `SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-04`, `SYS-NFR-06`, `SYS-NFR-07`, `SYS-NFR-11`, `SYS-NFR-12` | `apps/web/src/lib/db.ts`; `apps/web/src/lib/session.ts`; `apps/web/src/lib/admin-auth.ts`; `apps/web/src/lib/admin-activity.ts`; `apps/web/db/schema.sql`; `apps/web/src/app/api/health/route.ts` |
| `US-OA-14`, `US-OA-19` | `apps/web/src/lib/complaint-ai.ts`; `apps/web/src/lib/ai-enforcement.ts`; `apps/web/src/components/admin/complaints/AiComplaintReview.tsx`; `apps/web/src/components/admin/riders/RiderEnforcementActions.tsx` |
| `OA-08` | `apps/web/src/lib/admin-activity.ts`; `apps/web/src/lib/admin-actions.ts`; `apps/web/db/schema.sql` |
