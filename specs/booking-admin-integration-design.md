# Booking/Admin Integration Design

## Scope

Keep the public hotel frontend visually stable while strengthening the booking and admin flows using the referenced hotel booking project as a behavioral model.

## Acceptance Criteria

- Public pages keep their current layout, typography, imagery, and class structure.
- Booking requests validate dates, room existence, capacity, availability, and contact fields on both client and server.
- Admin can create, review, update, confirm, cancel, and archive reservations without overwriting existing content or runtime data.
- Image uploads remain direct, validated, converted to WebP, and stored outside committed runtime state.
- Uploaded image deletion is available only for admin-uploaded `/uploads/...webp` assets and refuses deletion while the saved site content still references the image.
- File writes create backups and run through an in-process mutation queue to reduce race conditions.
- Secrets, admin auth, reservation records, backups, and uploads stay ignored by git.

## Security Notes

- Admin APIs require the existing signed admin session.
- Public reservation and availability APIs remain rate-limited.
- Inputs are parsed with Zod and room-specific business validation before writes.
- API responses avoid exposing admin auth/session data or private runtime file paths.
