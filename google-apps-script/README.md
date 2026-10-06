# Connect the Calm Collective business calendar

The website is a room-hire service, not a therapy appointment service. The new interface distinguishes viewing requests and room-hire requests. It never describes a request as confirmed.

## Current state — 6 October 2026

- The existing `/exec` endpoint responds to read-only availability calls and uses Jack's personal calendar in the older source. Do not expose that as the business's room inventory.
- Until the v2 bridge below is deployed, the new website uses the existing callback-enquiry service. Requested room, date, time, duration, frequency and email are included in the enquiry email. Times are labelled **preferred times**, not availability. No calendar reservation is made by that fallback.
- The v2 code is prepared in this repository, not deployed to Google. No real request or notification was submitted during verification.
- The connected Supabase account does not grant access to the previous Calm Collective project. The available golf project must not be used for this business.

## Recommended setup

Keep one calendar for each room, plus a separate viewings calendar and the person hosting viewings. Viewings check both the viewings diary and the host diary. Room hire checks only the selected room. An owner can display all room calendars together in Google Calendar.

1. Sign in to the **business-owned Google account** that should run the booking system. Confirm with the owner which account this is. The public contact currently used by the site is `calmcollectivebooking@gmail.com`.
2. In Google Calendar create `Calm Collective — Calm Room`, `Calm Collective — Still Room`, `Calm Collective — Haven Room`, and `Calm Collective — Viewings`.
3. Share each diary with the Apps Script account using **Make changes to events**. Share the host diary with at least **See all event details** for this CalendarApp implementation. Do not make any diary public. A later Google free/busy API implementation can reduce host visibility.
4. In each calendar's Settings → Integrate calendar, copy its Calendar ID.
5. Open the existing Calm Collective Apps Script project. Replace `Code.gs` with this repository's version. Keep `appsscript.json` with `Europe/London`.
6. In Project Settings → Script properties add the following values. None belongs in browser JavaScript:

| Property | Value |
| --- | --- |
| `BUSINESS_EMAIL` | Business recipient for requests and customer replies |
| `VIEWING_CALENDAR_ID` | Viewings calendar ID |
| `HOST_CALENDAR_ID` | Diary of the person giving viewings |
| `CALM_ROOM_CALENDAR_ID` | Calm Room calendar ID |
| `STILL_ROOM_CALENDAR_ID` | Still Room calendar ID |
| `HAVEN_ROOM_CALENDAR_ID` | Haven Room calendar ID |
| `ROOM_OPEN_HOUR` | First room start hour, e.g. `8`; confirm business hours before activation |
| `ROOM_CLOSE_HOUR` | Closing hour, e.g. `21`; confirm before activation |
| `ROOM_OPEN_DAYS` | Allowed weekday numbers: Sunday `0` through Saturday `6`; e.g. `1,2,3,4,5,6,0` |

Viewings currently use the existing one-hour, Monday–Friday, 10am–4pm schedule. Room requests support 1–4 hours; all calendar requests are tomorrow through 90 days ahead. Review those rules with the business before enabling.

7. Run `installApprovalTrigger` once and authorise Calendar, Mail and trigger access. This processes owner decisions every five minutes. Use a Google test calendar first.
8. Deploy → Manage deployments → Edit the existing web app → **New version**. Execute as the business account, access **Anyone**. Reusing the deployment preserves the existing URL. If using a new deployment, change only `booking-config.js`.
9. Test `?action=booking-health&callback=calendarResponse`: version `2`, `viewing:true` and the connected room keys mean the website can offer calendar-backed times. It detects this automatically. Missing calendars retain request-only handling; unreadable calendars fail closed.

## What happens to a request

- Calendar availability is checked again under a script-wide lock before creating a pending hold. Repeated submissions with the same reference are idempotent. This prevents two website requests taking the same room/time.
- A pending hold is created on the relevant room/viewings diary and the business receives a notification. No public user can read event names, contacts or notes through the endpoint.
- The owner reviews the request, rates, suitability and (for regular hire) the proposed recurring arrangement.
- To approve, change the event title prefix from `PENDING —` to `CONFIRMED —`. The trigger emails the requester the actual event time.
- To decline, change it to `DECLINED —`. The trigger emails the requester and removes the declined hold. Do not simply delete a pending event if the customer should be notified.
- The weekly/longer-term selector requests that arrangement; **it does not reserve a recurring series**. Review and arrange future occurrences manually before confirming.
- Changing or cancelling an already confirmed event requires the business to contact the customer manually. There is no self-service cancellation or automatic reschedule notification in this release.
- Calendar edits made outside this script are not covered by the script lock. Staff must check before adding overlapping events. Pending holds should be reviewed daily.
- Notification delivery errors are marked on the event (`calmNotified: check-delivery`) for owner follow-up; the trigger does not risk sending duplicate confirmations automatically.

## Operational limits / next stage

This is a small-business approval-first bridge, not a payment or practitioner-membership system. Honeypot and per-contact throttling are basic spam controls, not comprehensive abuse prevention. Review public traffic, quotas and retention before wider rollout. Request status references are opaque UUIDs; no personal details are returned by status lookups. Script Properties retain only state and timestamp, not contact details. Periodically clear old `request:` properties after the agreed retention period; Google imposes storage and email quotas.

For instant confirmed room hire, approved practitioner sign-in, cancellations, audit history and payments, use the correct Supabase project for durable bookings with a database overlap constraint and RLS, and a server-side calendar integration. Keep Supabase as the booking authority and sync calendar events with retries; calendar display alone does not make a transaction safe. Do not add private keys to this static frontend.

## Acceptance checks before enabling real calendar bookings

Use test calendars and consenting test email addresses: busy events hide slots; two competing requests cannot both reserve one room; the same request reference cannot create duplicates; separate rooms can be used simultaneously; winter/summer UK times are correct; unavailable calendars offer no slots; approval and decline deliver once; declined holds release availability. A timeout in the website asks the visitor to contact the team with their reference rather than resubmit blindly.

References: [Apps Script Calendar](https://developers.google.com/apps-script/reference/calendar/calendar), [LockService](https://developers.google.com/apps-script/reference/lock/lock-service), [Script Properties](https://developers.google.com/apps-script/guides/properties), [Google free/busy API](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query).
