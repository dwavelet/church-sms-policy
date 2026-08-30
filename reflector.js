// Twilio Function: /reflector
//
// REPLACES members.json with Twilio Sync for live PENDING → ACTIVE state.
//
// SETUP (one-time):
//   1. Twilio Console → Sync → Services → Create Service → copy the SID
//   2. Functions Service → Settings → Environment Variables:
//        SYNC_SERVICE_SID = ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//   3. Run seed.js once to load your founding leaders into Sync
//   4. Remove members.json asset — no longer used
//
// LEADER COMMANDS (text to the group number):
//   ADD +14045551234 Alice   — adds PENDING member, sends consent SMS
//
// MEMBER KEYWORDS:
//   YES  — confirms consent: PENDING → ACTIVE
//   STOP — opt out (Twilio handles delivery; we log the timestamp)
//   HELP — returns help + policy links

const TERMS_URL   = 'https://dwavelet.github.io/church-sms-policy/terms.html';
const PRIVACY_URL = 'https://dwavelet.github.io/church-sms-policy/privacy.html';
const MAP_NAME    = 'members';

exports.handler = async function (context, event, callback) {
  const client   = context.getTwilioClient();
  const twiml    = new Twilio.twiml.MessagingResponse();
  const SYNC_SID = context.SYNC_SERVICE_SID;

  const groupNumber = event.To;
  const fromE164    = toE164(event.From);
  const body        = (event.Body || '').trim();
  const keyword     = body.toUpperCase();

  // ── Sync helpers ───────────────────────────────────────────────────

  async function getMember(e164) {
    try {
      const item = await client.sync.v1
        .services(SYNC_SID).syncMaps(MAP_NAME).syncMapItems(e164).fetch();
      return item.data;
    } catch (_) { return null; }
  }

  async function setMember(e164, data) {
    try {
      await client.sync.v1
        .services(SYNC_SID).syncMaps(MAP_NAME).syncMapItems(e164).update({ data });
    } catch (_) {
      await client.sync.v1
        .services(SYNC_SID).syncMaps(MAP_NAME).syncMapItems.create({ key: e164, data });
    }
  }

  async function getActiveMembers() {
    const items = await client.sync.v1
      .services(SYNC_SID).syncMaps(MAP_NAME).syncMapItems.list({ limit: 200 });
    return items
      .filter(i => i.data.status === 'ACTIVE')
      .map(i => ({ e164: i.key, ...i.data }));
  }

  async function getLeader() {
    const items = await client.sync.v1
      .services(SYNC_SID).syncMaps(MAP_NAME).syncMapItems.list({ limit: 200 });
    const lead = items.find(i => i.data.leader === true);
    return lead ? { e164: lead.key, ...lead.data } : null;
  }

  function toE164(raw) {
    const digits = (raw || '').replace(/\D/g, '');
    return '+1' + digits.slice(-10);
  }

  // ── HELP ────────────────────────────────────────────────────────────
  if (keyword === 'HELP') {
    twiml.message(
      'BibleStudy: Reply YES to confirm enrollment or STOP to opt out. ' +
      `Terms: ${TERMS_URL} Privacy: ${PRIVACY_URL}`
    );
    return callback(null, twiml);
  }

  // ── STOP — log opt-out time; Twilio sends confirmation automatically ─
  if (keyword === 'STOP') {
    const member = await getMember(fromE164);
    if (member) {
      await setMember(fromE164, {
        ...member,
        status: 'OPTED_OUT',
        consentLog: {
          ...member.consentLog,
          optOutTime: new Date().toISOString(),
        },
      });
    }
    return callback(null, twiml);
  }

  // ── YES — PENDING → ACTIVE ──────────────────────────────────────────
  if (keyword === 'YES') {
    const member = await getMember(fromE164);
    if (member && member.status === 'PENDING') {
      const now = new Date().toISOString();
      await setMember(fromE164, {
        ...member,
        status: 'ACTIVE',
        consentLog: { ...member.consentLog, yesConfirmationTime: now },
      });
      twiml.message(
        'BibleStudy: You\'re confirmed and enrolled in the recurring ' +
        'BibleStudy SMS group. Msg frequency varies. Msg & data rates ' +
        'may apply. Reply HELP for help or STOP to opt out.'
      );
      // Announce to existing members
      const active = await getActiveMembers();
      const others = active.filter(m => m.e164 !== fromE164);
      await Promise.all(others.map(m =>
        client.messages.create({
          to: m.e164, from: groupNumber,
          body: `BibleStudy: ${member.name} has joined the group.`,
        })
      ));
      return callback(null, twiml);
    }
    // YES from non-PENDING — fall through to relay as normal message
  }

  const sender = await getMember(fromE164);

  // ── LEADER ADD COMMAND: ADD +1xxxxxxxxxx Name ───────────────────────
  if (sender && sender.leader && body.toUpperCase().startsWith('ADD ')) {
    const parts   = body.trim().split(/\s+/);
    const rawPhone = parts[1] || '';
    const newName  = parts.slice(2).join(' ');
    const newE164  = toE164(rawPhone);

    if (!newName || newE164.length !== 12) {
      twiml.message('BibleStudy: Usage: ADD +14045551234 Firstname Lastname');
      return callback(null, twiml);
    }

    const now = new Date().toISOString();
    await setMember(newE164, {
      name: newName,
      status: 'PENDING',
      leader: false,
      consentLog: {
        verbalConsentTime:       now,
        collectedBy:             sender.name,
        confirmationRequestTime: now,
        yesConfirmationTime:     null,
        optOutTime:              null,
      },
    });

    await client.messages.create({
      to: newE164, from: groupNumber,
      body:
          `BibleStudy: You verbally agreed to receive recurring BibleStudy ` +
          `texts. Msg frequency varies. Msg & data rates may apply. ` +
          `Reply YES to confirm, HELP for help, STOP to opt out. ` +
          `Privacy: ${PRIVACY_URL} Terms: ${TERMS_URL}`,
    });

    twiml.message(
      `BibleStudy: Consent request sent to ${newName} (${rawPhone}). ` +
      `Awaiting YES.`
    );
    return callback(null, twiml);
  }

  // ── Guard: unrecognized number ──────────────────────────────────────
  if (!sender) {
    twiml.message('BibleStudy: This number is not registered. Contact the group leader to be added.');
    return callback(null, twiml);
  }

  // ── Guard: PENDING (hasn't replied YES yet) ─────────────────────────
  if (sender.status === 'PENDING') {
    twiml.message('BibleStudy: Your enrollment is pending. Reply YES to confirm and join the group.');
    return callback(null, twiml);
  }

  // ── Guard: opted out ────────────────────────────────────────────────
  if (sender.status === 'OPTED_OUT') {
    twiml.message('BibleStudy: You have opted out. Contact the group leader to rejoin.');
    return callback(null, twiml);
  }

  // ── Guard: empty body ───────────────────────────────────────────────
  if (!body) return callback(null, twiml);

  // ── RELAY — ACTIVE members only ─────────────────────────────────────
  const active     = await getActiveMembers();
  const recipients = active.filter(m => m.e164 !== fromE164);

  await Promise.all(recipients.map(r =>
    client.messages.create({
      to: r.e164, from: groupNumber,
      body: `BibleStudy — ${sender.name}: ${body}`,
    })
  ));

  return callback(null, twiml);
};
