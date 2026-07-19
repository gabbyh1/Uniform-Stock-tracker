# Password-only staff authentication setup

The website remains a static GitHub-hosted application. Permanent staff access uses only a password, while temporary access uses a username and password. No email accounts are introduced.

The browser now sends passwords only to a Supabase database function over HTTPS. Passwords are pre-hashed in full and then stored with salted, costed bcrypt, successful logins receive a random eight-hour session token, and Row Level Security checks that token on every staff data request.

## Apply the database migration

1. Back up the Supabase database.
2. Open the Supabase SQL Editor.
3. Run [`supabase/migrations/20260716_password_only_staff_auth.sql`](supabase/migrations/20260716_password_only_staff_auth.sql).
   If the original migration was already applied before the authentication expiry fix, also run [`supabase/migrations/20260716213500_fix_authenticate_staff.sql`](supabase/migrations/20260716213500_fix_authenticate_staff.sql).
4. Set a new permanent staff password in the SQL Editor:

   ```sql
   select public.set_staff_password('1384-Staff');
   ```

5. Do not save the real password in this repository, an issue, or a commit.
6. Test permanent login, temporary credential creation, temporary login, logout, and expiry before relying on the system operationally.

## Existing temporary credentials

Existing plaintext temporary passwords are hashed during migration and the plaintext database column is removed. Each migrated credential receives a username based on its previous Name/Reason followed by a number. Staff can see these usernames on the Temporary Passwords page; the original temporary password continues to work until its existing expiry.

## Security behaviour

- Permanent access requires only the permanent password; leave the temporary username field blank.
- Temporary access requires both the temporary username and temporary password.
- New permanent staff passwords must contain at least 10 characters; temporary passwords must contain at least 6 characters. Spaces and Unicode are accepted and no character-composition rule is imposed.
- Five failed attempts against one account, or twenty failed attempts from one client, trigger a 15-minute lockout. A successful login clears that client's recent failures.
- Staff sessions last up to eight hours; temporary sessions cannot outlive the temporary credential.
- Session tokens are stored in `sessionStorage`, so they are isolated to the current browser tab.
- Logout revokes the server-side session immediately.
- Disabling temporary access immediately revokes sessions created with that username.
- Public cadet requests are validated and limited to ten submissions per 15 minutes per client.
- The Supabase publishable key remains in the browser by design. It is not a privileged secret; RLS is the security boundary.
- Never place a Supabase secret or service-role key in this repository.

## Password rotation

Run `public.set_staff_password` again from the Supabase SQL Editor. Changing the permanent password revokes every active staff and temporary session.

The old password previously committed in `index.html` must be considered compromised and should not be reused.
