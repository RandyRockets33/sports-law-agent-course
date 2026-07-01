# Sports Agent Academy QA Instructions

Use these steps after the fixed build is deployed to `https://sportsagentacademy.netlify.app`.

## Quick Smoke Test

1. Open `https://sportsagentacademy.netlify.app/` in a private/incognito window.
2. Confirm the top navigation shows `Sign in` and `Enroll`.
3. Confirm the homepage preview section shows 15 playable preview clips.
4. Play several preview clips and confirm playback sounds normal, not sped up.
5. Click `Modules`, open Module 1, and confirm Module 1 is viewable without paying.
6. Open Module 5 and confirm only the 10-second preview is visible before login.
7. Click `Enroll` and confirm the pricing page loads.
8. Click `Enroll now` on pricing and confirm Stripe checkout opens for Sports Agent Academy.

## Enrolled User Test

Preferred clean test path: use the admin panel to grant a test email. Do not use a coupon that belongs to another product/site.

1. Create a fresh test email address or alias.
2. Open `/admin/` as an admin user.
3. Use `Grant/Revoke Access` to grant `full` access to the test email.
4. Open the public site in an incognito window.
5. Click `Sign in`, enter the test email, then enter the emailed verification code.
6. Open Module 5 and confirm the full lecture, audio, quiz, exercise, and materials appear.
7. Open `Library` and confirm all Word-document download buttons are unlocked.
8. Open `Account` and confirm the user shows as enrolled/full access.
9. Open `Quizzes` and click quiz links for Modules 1, 8, and 15; each should land on the module without a broken anchor.

## Team Link QA

Assign one tester each to these paths:

- Homepage: all nav items, all homepage preview clips, `Enroll`, `Preview Module 1`, `See all 15 modules`.
- Modules: `Modules` index, Modules 1, 5, 8, 15, previous/next module links, `Open library`, `My account`, quiz links.
- Library: all five free preview pages, back-to-library buttons, enrolled document-download buttons after full access.
- Tracks: aspiring agents, law students, practitioners, their library links, module-start links, pricing recommendation links.
- Account/grades: account dashboard, grades page, certificate area after enough progress.
- Mobile: repeat homepage, module page, pricing, and admin login on a phone-width viewport.

## Admin Panel Test

1. Confirm the admin email is included in Netlify env var `ADMIN_EMAILS`.
2. Open `https://sportsagentacademy.netlify.app/admin/`.
3. Click `Sign in to admin`, enter the admin email, and enter the emailed code.
4. Confirm stats load: users, enrolled users, certificates, revenue, last-7-day stats.
5. Grant full access to a test email.
6. Sign in publicly with that test email and confirm the site unlocks.
7. Revoke that test email in admin.
8. Sign out/sign back in publicly and confirm access is removed.

## Known Deployment Note

The local build passed static crawl and media QA. Production still requires a Netlify-authenticated deploy from this environment or another logged-in Netlify deploy path.
