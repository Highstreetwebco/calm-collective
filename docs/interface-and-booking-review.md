# Calm Collective interface and booking review — 6 October 2026

Reviewed a representative set of therapy-room hire websites, including nearby operators. This was an inspection of published content and booking journeys, not measured conversion performance or an exhaustive survey of the market.

| Reference | Useful pattern | Calm Collective implementation |
| --- | --- | --- |
| [Positive Mind Space](https://positivemindspace.com/) | Clearly identifies practitioners and distinguishes occasional, weekly and longer-term use | Clear room-hire positioning and three hire arrangements |
| [Meet by the Park](https://www.meetbythepark.com/therapy-rooms) | Named rooms with individual booking actions | Each room preselects itself in the request form |
| [The Cloisters](https://thecloisters.co.uk/our-clinic/) | Practical room, access and booking information | Shared facilities, location, access questions and booking status explained clearly |
| [TherapyRooms](https://therapyrooms.com/) | Application and approval before booking access | Explicit approval-first requests; no instant confirmation claims |
| [MyTherapyRoom](https://mytherapyroom.co.uk/) | Direct room-discovery journey and concise facilities information | Rooms, hire options and booking are directly accessible from navigation |

Kept the sage, ivory and forest palette, lotus wordmark, editorial serif and supplied imagery. Removed the entire opening sequence, including scroll hijacking and reveal effects. Did not copy third-party photos, testimonials, prices or business claims.

The room photos, access specifications and equipment were marked as unfinished in the source. That limitation is retained. Prices remain unpublished in line with the existing direction.

## Delivery and operation

`index.html`, `style.css`, `script.js` and `booking-config.js` are the canonical static source. Run `node scripts/sync-surfaces.mjs` to synchronise the retained React page, public support files and deployable `dist` folder. GitHub Pages uses the root files. Sites uses the same static output to prevent the old React introduction/disabled booking form drifting from the live website.

The existing Google enquiry endpoint was verified using read-only health and availability calls. No real customer request or email was sent for testing. Calendar bridge tests use in-memory mocks for conflicts, duplicate references, permission failures, UK offsets and approval handling. New Google backend code still requires owner setup/deployment. See [calendar setup](../google-apps-script/README.md).

Supabase project access for Calm Collective is unavailable on the current connection. No database or golf-project changes have been made.

## Customer and developer review — follow-up

### Looking to hire a room

The previous flow required a date and time before a visitor could discuss price, suitability or a regular arrangement. Added a question route and a default “Discuss dates with the team” choice for viewings and hire. Selecting a specific date still requires a valid date and time. A flexible enquiry sends no calendar reservation, including when the calendar bridge is connected. Room-specific links retain the named room and open a question enquiry.

Photos now precede the named room choices. The room cards are compact, avoiding repeated generic descriptions that did not help visitors compare. Photographs remain unassigned to named rooms until the owner confirms the mapping. A “Before you commit” panel sets out room suitability, rates/terms and arrival/access questions. Public prices remain omitted as previously requested.

### First visit

The main heading explicitly identifies therapy room hire; Warwick and the full address are visible in the opening section. A low-commitment rates/availability link sits beside the main viewing journey. Every viewing CTA selects the viewing option consistently. The complete uploaded photos remain uncropped, with consistent gallery frames and full-size viewing. Removed speculative construction/opening deadlines from FAQ answers without asserting unverified access or facilities.

### Development and accessibility

Added recovery for an unavailable enquiry service, revalidation of earlier form steps before sending, excluded hidden dates from flexible enquiries, respected reduced-motion preferences during form scrolling, improved the sticky-header scroll offset and mobile safe-area spacing. Updated social preview and structured-data imagery to a supplied room photograph. Preserved single-source generation across static and retained React surfaces.

Validation: JavaScript syntax check; DOM journeys for flexible and dated enquiries, room/intent selection, summary and payload accuracy, hidden/stale dates, offline recovery and duplicate prevention; nine mocked backend calendar tests; local asset, ID and anchor checks. Tests use mock services and send no real enquiries. The existing public desktop layout was reviewed in a browser. Updated mobile layout has static/DOM checks; no mobile browser/device rendering was available in this environment.

Outstanding business facts: named-room photo mapping, exact capacities/equipment, confirmed access and facilities, hire rates/terms, opening/operating hours, and the business calendar account. These are not invented in the interface. The prepared Google bridge remains undeployed; the active site uses the existing enquiry service and never presents that service’s personal-calendar slots as business availability.
