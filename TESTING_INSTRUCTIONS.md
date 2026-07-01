# Sports Agent Academy QA Instructions

Production URL: `https://sportsagentacademy.netlify.app`

There is one certification program. One $497 purchase unlocks the full course: all 15 modules, all full videos, audio, quizzes, exercises, downloadable library documents, grades, account, and certificate path.

## Quick Smoke Test

1. Open `https://sportsagentacademy.netlify.app/` in a private/incognito window.
2. Confirm the top navigation shows `Sign in` and `Enroll`.
3. Confirm the homepage says `One certification program` and does not show old agent/law-student/practitioner track choices.
4. Confirm the homepage preview section shows 15 playable preview clips.
5. Play several preview clips and confirm playback sounds normal.
6. Open Module 5 and confirm only the preview is visible before login.
7. Click `Enroll`, then `Enroll now`, and confirm Stripe checkout opens for Sports Agent Academy.

## Free Team Access Test

Use team code `GDTEST100` on the private team test page. It grants Full Access to the tester email and sends the normal sign-in verification code.

1. Use a fresh test email address or alias.
2. Go to `https://sportsagentacademy.netlify.app/team-test.html`.
3. Enter the test email and team code `GDTEST100`.
4. Click `Grant Full Access`.
5. Check the test inbox for the 6-digit verification code.
6. Click `Sign in`, enter the same email, and enter the verification code.
7. Open Module 5 and confirm the full lecture, audio, quiz, exercise, and materials appear.
8. Open `Library` and confirm all document download buttons are unlocked.
9. Open `Account` and confirm the user shows `Full Access`.

## Admin Panel Test

Admin URL: `https://sportsagentacademy.netlify.app/admin/`

1. Sign in as `randy@ghostdawgconsulting.com`.
2. Enter the emailed verification code.
3. Confirm stats load for users, enrolled users, certificates, revenue, and recent activity.
4. Use `Grant/Revoke Access` to grant `full` access to a fresh test email.
5. Sign in publicly with that test email and confirm the entire site unlocks.
6. Revoke that test email in admin.
7. Sign out/sign back in publicly and confirm access is removed.

## Team QA Coverage

Assign one tester each to these paths:

- Homepage: navigation, all preview clips, `Enroll`, `Preview Module 1`, `See all 15 modules`.
- Modules: module index, Modules 1, 5, 8, 15, previous/next links, library links, account links, quiz links.
- Library: preview documents before enrollment, every downloadable document after Full Access.
- Checkout/access: $497 checkout, `GDTEST100` team-code grant, return flow, login flow.
- Account/grades: account dashboard, grades page, certificate progress.
- Admin: login, stats, manual grant, manual revoke.
- Mobile: homepage, module page, pricing, sign-in, and admin login on a phone-width viewport.

## Expected Result

Every successful paid purchase, `GDTEST100` team-code grant, or admin grant should produce the same result: `Full Access` across the entire course.
