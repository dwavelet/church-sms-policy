# BibleStudy SMS Reflector — Setup Guide

## Architecture change
`members.json` is **retired**. Member state (PENDING / ACTIVE / OPTED_OUT)
and consent records now live in **Twilio Sync**, a key-value store hosted
by Twilio. No external database or server is needed.

---

## One-time Twilio setup

### 1. Create a Sync Service
Console → Sync → Services → **Create new Service**
Name it `bible-study` → copy the **Service SID** (starts with `IS...`)

### 2. Add environment variable to your Functions Service
Console → Functions → Services → `bible-study-reflector`
→ Settings → Environment Variables → Add:

| Key | Value |
|-----|-------|
| `SYNC_SERVICE_SID` | `ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |

### 3. Deploy updated reflector.js
Paste the new `reflector.js` into the Function editor → **Deploy All**
Remove `members.json` asset — it is no longer used.

### 4. Seed founding members
Edit `seed.js` — fill in your real E.164 phone numbers and names.
Then run from Termux:

```bash
pkg install nodejs
npm install twilio

TWILIO_ACCOUNT_SID=ACxxx \
TWILIO_AUTH_TOKEN=xxx \
SYNC_SID=ISxxx \
node seed.js
```

Founding members are loaded as ACTIVE with a seeded consent log.

---

## Enrolling a new member

1. Leader reads the standardized disclosure to the prospective member.
2. Member says **yes** verbally.
3. Leader texts the group number:
   ```
   ADD +14045551234 Firstname Lastname
   ```
4. BibleStudy sends the prospective member the consent SMS automatically.
5. Prospective member replies **YES**.
6. Status changes PENDING → ACTIVE. Group is notified.

---

## Leader command reference

| Command | Effect |
|---------|--------|
| `ADD +1xxxxxxxxxx Name` | Add PENDING member, send consent SMS |

## Member keyword reference

| Keyword | Effect |
|---------|--------|
| `YES`  | PENDING → ACTIVE, sends welcome, notifies group |
| `STOP` | Opt out, logs timestamp, Twilio blocks further delivery |
| `HELP` | Returns help message with policy links |

---

## Viewing consent records

Console → Sync → Services → `bible-study` → Maps → `members`
→ click any key (phone number) to see the full consent log:

```json
{
  "name": "Alice",
  "status": "ACTIVE",
  "leader": false,
  "consentLog": {
    "verbalConsentTime":       "2026-08-24T14:00:00.000Z",
    "collectedBy":             "Pastor Dave",
    "confirmationRequestTime": "2026-08-24T14:00:05.000Z",
    "yesConfirmationTime":     "2026-08-24T14:03:22.000Z",
    "optOutTime":              null
  }
}
```

This record is your audit trail for carrier compliance.

---

## Removing a member manually
Console → Sync → Maps → `members` → find their key → delete the item,
or update `status` to `OPTED_OUT` to preserve the consent log.

## Cost addition
Twilio Sync free tier: 10,000 operations/month. At 25 members this
costs nothing additional.
