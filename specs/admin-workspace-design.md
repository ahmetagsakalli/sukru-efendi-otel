# Hotel administration workspace

The existing panel has room, reservation, payment, guest, image and content operations. This revision makes those operations easier to understand, protects unsaved content, fixes editing focus and room identity issues, and exposes the reservation presentation and translated site content.

## Acceptance criteria

- A responsive, grouped navigation and consistent Playfair Display typography; clear page descriptions and a site preview link.
- Dashboard occupancy reflects rooms occupied tonight, with today's arrivals/departures and useful shortcuts.
- Content saves distinguish persisted content from unsaved changes. Editing during a request is retained, leaving warns about unsaved changes, and operational sections do not imply that the site-content save button saves reservations or payments.
- Editable string lists retain focus while typing. Renaming a room does not silently alter its URL; reordering keeps the chosen room selected.
- Turkish, English and German reservation presentation text, and English/German page/room/service/gallery text can be edited and reach public pages. Images, inventory and prices continue to come from shared room data.
- Presentation metadata (tone, icon, heritage age and room URL) stays internal rather than appearing as editable panel fields. New room URLs are assigned uniquely.
- Backward-compatible defaults load existing content. Authenticated content writes validate through Zod; no secrets or credentials are introduced into public content.
- Existing admin flows and public booking checks run on isolated test data. The local password is configured independently and never reset by tests.

## Implementation

Frontend: retain established reservation/payment actions and extract reusable admin controls/editors. Add a dedicated admin stylesheet, custom selection/date panels, save state and keyboard support. Backend: extend the existing content schema and existing authenticated persistence endpoint, preserving atomic writes and backups. Security: preserve authentication on writes, validate content server-side, use React text rendering, validate image references and keep credentials separate.

No deployment, external messages, payment transfers or live test reservations are part of this revision.
