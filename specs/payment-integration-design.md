# Payment Integration Design

## Goal

Prepare the hotel site for online payments without collecting or storing card data on the application server. The initial implementation supports a disabled mode, a local/VPS mock mode, and PayTR iFrame mode.

## Flow

1. Guest submits a reservation request.
2. If `PAYMENT_PROVIDER=disabled`, the existing request-only flow remains unchanged.
3. If a payment provider is enabled, the reservation is saved with `paymentStatus=pending`.
4. The frontend calls `/api/payments/create` with the reservation id.
5. The server validates the reservation, creates a provider session, stores the provider reference, and marks the payment as `processing`.
6. The guest completes payment on the provider-controlled page.
7. PayTR posts the result to `/api/payments/paytr/callback`.
8. The callback hash is verified server-side before any reservation update.
9. Successful payment marks the reservation `paid` and confirms the reservation when inventory is still available.

## Security Notes

- Card numbers never touch the site backend.
- Payment provider secrets are read only from environment variables.
- Payment creation is rate limited.
- PayTR callbacks require HMAC verification.
- Duplicate success callbacks are idempotent.
- Processing payments hold inventory for `PAYMENT_HOLD_MINUTES`; stale holds stop blocking availability.

## VPS Setup Checklist

- Set `PAYMENT_PROVIDER=paytr`.
- Set `PAYMENT_BASE_URL` to the final HTTPS domain.
- Set `PAYTR_MERCHANT_ID`, `PAYTR_MERCHANT_KEY`, and `PAYTR_MERCHANT_SALT`.
- Keep `PAYTR_TEST_MODE=1` until real test cards/callbacks pass.
- Configure the PayTR callback URL as `/api/payments/paytr/callback`.
- Switch `PAYTR_TEST_MODE=0` only after the provider approves live processing.
