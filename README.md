# BibleStudy A2P Verbal Opt-In Package

This package replaces the earlier Via-Text/JOIN design with a verbal-only enrollment design.

Files:
- join.html — public verbal-consent/enrollment procedure
- privacy.html — revised SMS privacy policy
- terms.html — revised SMS terms
- verbal-consent-script.md — exact script and operating procedure
- A2P-registration-values.md — proposed Twilio registration text

Deployment:
1. Replace the public join.html, privacy.html, and terms.html files.
2. Keep sisters.jpg in the same directory.
3. Verify the public URLs.
4. Configure the A2P registration as Verbal only.
5. Make the relay enforce PENDING -> YES -> ACTIVE and STOP -> OPTED_OUT.
6. Run Twilio's campaign checker before submission.

Important: the registration, public documents, verbal procedure, and live application behavior must remain consistent.
