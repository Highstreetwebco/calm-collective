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
