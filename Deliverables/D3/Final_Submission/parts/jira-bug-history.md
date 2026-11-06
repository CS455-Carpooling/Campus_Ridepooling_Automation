# D3 Bug and Defect History in Jira

The 26 Bug issues labelled `d3` in the Jira project `CS455`, from the snapshot of 6 November 2026. Each key links to the issue. The Bug and Defect History Report that follows gives the cause, fix and evidence for each one.

Jira filter: `project = CS455 AND issuetype = Bug AND labels = d3`

These issues were recorded after their fixes, so their dates show when each record was created and closed, not when the defect was found.

| Issue | Summary | Status | Assignee | Created | Resolved |
|---|---|---|---|---|---|
| [CS455-133](https://cs455project.atlassian.net/browse/CS455-133) | PostgreSQL timestamp parameter type mismatch causes query failures | Done | Mainak Sarkar | 4 Nov | 4 Nov |
| [CS455-134](https://cs455project.atlassian.net/browse/CS455-134) | Idempotency key reuse with different ride details silently returns the original request | Done | Mainak Sarkar | 4 Nov | 4 Nov |
| [CS455-136](https://cs455project.atlassian.net/browse/CS455-136) | Credentialed cross-origin Socket.IO handshake accepted an untrusted Origin | Done | Chaitanya Nitawe | 5 Nov | 5 Nov |
| [CS455-137](https://cs455project.atlassian.net/browse/CS455-137) | Realtime authentication ignored the seven-day inactivity expiry | Done | Mahir Jain | 5 Nov | 5 Nov |
| [CS455-138](https://cs455project.atlassian.net/browse/CS455-138) | PostgreSQL TLS connections did not verify server certificates | Done | Mahir Jain | 5 Nov | 5 Nov |
| [CS455-139](https://cs455project.atlassian.net/browse/CS455-139) | Legacy rides migration referenced locked_at before adding the column | Done | Mahir Jain | 5 Nov | 5 Nov |
| [CS455-140](https://cs455project.atlassian.net/browse/CS455-140) | Client-controlled forwarding headers could bypass IP rate limits | Done | Mahir Jain | 5 Nov | 5 Nov |
| [CS455-141](https://cs455project.atlassian.net/browse/CS455-141) | Malformed cookies could disrupt WebSocket authentication | Done | Mahir Jain | 5 Nov | 5 Nov |
| [CS455-142](https://cs455project.atlassian.net/browse/CS455-142) | Legacy ride_join_requests migration could reference missing updated_at | Done | Mahir Jain | 5 Nov | 5 Nov |
| [CS455-143](https://cs455project.atlassian.net/browse/CS455-143) | Password-reset token consumption and credential changes were not atomic | Done | Mahir Jain | 5 Nov | 5 Nov |
| [CS455-144](https://cs455project.atlassian.net/browse/CS455-144) | Realtime activity did not refresh session activity | Done | Mahir Jain | 5 Nov | 5 Nov |
| [CS455-145](https://cs455project.atlassian.net/browse/CS455-145) | Realtime authentication bypassed profile and warning eligibility gates | Done | Mahir Jain | 5 Nov | 5 Nov |
| [CS455-146](https://cs455project.atlassian.net/browse/CS455-146) | Production server did not fail fast when APP_URL was missing | Done | Mahir Jain | 5 Nov | 5 Nov |
| [CS455-147](https://cs455project.atlassian.net/browse/CS455-147) | Production realtime accepted the development session-cookie name | Done | Mahir Jain | 5 Nov | 5 Nov |
| [CS455-148](https://cs455project.atlassian.net/browse/CS455-148) | HTTP authentication could revive an inactivity-expired session | Done | Mahir Jain | 5 Nov | 5 Nov |
| [CS455-149](https://cs455project.atlassian.net/browse/CS455-149) | Existing cursor indexes were not upgraded by IF NOT EXISTS | Done | Mahir Jain | 5 Nov | 5 Nov |
| [CS455-150](https://cs455project.atlassian.net/browse/CS455-150) | One person could hold overlapping seats or offer an overlapping ride (P-08) | Done | Mainak Sarkar | 5 Nov | 5 Nov |
| [CS455-151](https://cs455project.atlassian.net/browse/CS455-151) | A suspended rider could continue posting in pool chats | Done | Mainak Sarkar | 5 Nov | 5 Nov |
| [CS455-152](https://cs455project.atlassian.net/browse/CS455-152) | Pool chat deletion could remove messages cited by an unresolved complaint | Done | Mainak Sarkar | 5 Nov | 5 Nov |
| [CS455-153](https://cs455project.atlassian.net/browse/CS455-153) | Admin chat-report resolution lacked audit and request protections | Done | Mainak Sarkar | 5 Nov | 5 Nov |
| [CS455-154](https://cs455project.atlassian.net/browse/CS455-154) | A rider who left before the trip could still file trip complaints | Done | Mainak Sarkar | 5 Nov | 5 Nov |
| [CS455-155](https://cs455project.atlassian.net/browse/CS455-155) | Completed-trip counts and rating eligibility included no-shows or leavers | Done | Mainak Sarkar | 5 Nov | 5 Nov |
| [CS455-156](https://cs455project.atlassian.net/browse/CS455-156) | Editing a ride did not enforce the three-hour maximum departure window | Done | Mainak Sarkar | 5 Nov | 5 Nov |
| [CS455-157](https://cs455project.atlassian.net/browse/CS455-157) | Account deletion could orphan active seats or waiting requests | Done | Mainak Sarkar | 5 Nov | 5 Nov |
| [CS455-158](https://cs455project.atlassian.net/browse/CS455-158) | Itinerary reconfirmation silently returned a request to Pending | Done | Mainak Sarkar | 5 Nov | 5 Nov |
| [CS455-159](https://cs455project.atlassian.net/browse/CS455-159) | Scheduled rides could not be cancelled or started consistently at the departure-window end | Done | Mainak Sarkar | 5 Nov | 5 Nov |

The other 3 Bug issues in the project ([CS455-4](https://cs455project.atlassian.net/browse/CS455-4), [CS455-5](https://cs455project.atlassian.net/browse/CS455-5), [CS455-6](https://cs455project.atlassian.net/browse/CS455-6)) are Deliverable 1 documents that were filed as Bugs, not defects.
