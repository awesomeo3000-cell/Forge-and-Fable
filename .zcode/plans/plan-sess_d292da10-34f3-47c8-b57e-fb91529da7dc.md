## Plan: Email Verification for Dreamwright.gg

### 1. Install Resend SDK
- `npm install resend`

### 2. Database Migration (schema revision 18) — `src/lib/db.ts`
- Add `email_verified INTEGER NOT NULL DEFAULT 0` to `users` table
- Add `verification_tokens` table: `id`, `user_id` FK, `token_hash` TEXT, `expires_at` TEXT, `created_at` TEXT
- Migration SQL grants `email_verified = 1` to all existing users (no lockouts)

### 3. Email Library — new `src/lib/email.ts`
- `sendVerificationEmail(email, name, token)` — sends via Resend from `noreply@dreamwright.gg`
- Email links to `https://dreamwright.gg/api/auth/verify?token=<sha256-hash>`
- Tokens: `crypto.randomUUID()`, stored as SHA-256 hashes, expire after 24h

### 4. Verification Store — new `src/lib/verificationStore.ts`
- `createVerificationToken(userId)` → generates token, stores hash in DB
- `consumeVerificationToken(rawToken)` → look up hash, mark user verified, delete token
- `isEmailVerified(userId)` → check users table

### 5. Update Registration Route — `src/app/api/auth/register/route.ts`
- After `registerUser()` succeeds → create verification token → send email
- Do NOT set session cookie (user not verified yet)
- Return `{ message: "Check your email..." }` instead of `{ user }`

### 6. New Verification Endpoint — `src/app/api/auth/verify/route.ts`
- `GET /api/auth/verify?token=...`
- Verifies, marks user verified, redirects to `/` with `?verified=1`

### 7. Update Login Route — `src/app/api/auth/login/route.ts`
- After password check, verify `email_verified` is true
- If not → return error "Please verify your email first"

### 8. Update Types — `src/types/game.ts`
- Add `emailVerified?: boolean` to `PublicUser`

### 9. Frontend Changes
- `ForgeAndFableApp.tsx` — handle new registration response (message vs user), show status
- AuthScreen already renders `props.status` — no changes needed

### 10. Environment & DNS
- Add `APP_URL=https://dreamwright.gg` to Render env vars
- Add `RESEND_API_KEY` to Render (already in .env.local)
- **Porkbun**: Add Resend domain verification DNS records for `dreamwright.gg`

### 11. Render Config — `render.yaml`
- Add `RESEND_API_KEY` and `APP_URL` env var entries