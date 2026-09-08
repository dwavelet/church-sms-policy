// seed.js — run ONCE in Termux to load founding members into Twilio Sync
//
// Prerequisites in Termux:
//   pkg install nodejs
//   npm install twilio
//
// Usage:
//   TWILIO_ACCOUNT_SID=ACxxx TWILIO_AUTH_TOKEN=xxx \
//   SYNC_SID=ISxxx node seed.js

const twilio    = require('twilio');
const client    = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const SYNC_SID  = process.env.SYNC_SID;
const MAP_NAME  = 'members';

// ── Edit this list before running ─────────────────────────────────────
const FOUNDING_MEMBERS = [
  { e164: '+13212985804', name: 'Mia Gifford', leader: true  },
  { e164: '+13216072689', name: 'Brittany Gifford', leader: false },
  { e164: '+13217477798', name: 'Bridgette Gifford', leader: false },
  { e164: '+13214586690', name: 'Al Douglas', leader: false },
  { e164: '+13216842927', name: 'Alak`e Davis', leader: false },
  { e164: '+13215361615', name: 'Alma Adams', leader: false },
  { e164: '+14072364944', name: 'Bonita Ross', leader: false },
  { e164: '+13216338323', name: 'Cameo Bradley', leader: false },
  { e164: '+13215912190', name: 'Cathy NLN', leader: false },
  { e164: '+13212897100', name: 'Deborah NLN', leader: false },
  { e164: '+14109523409', name: 'Janice Chance', leader: false },
  { e164: '+13212891922', name: 'Jolie Cogan', leader: false },
  { e164: '+13212662571', name: 'Gwen Richardson', leader: false },
  { e164: '+13215256108', name: 'Minnie Orr', leader: false },
  { e164: '+13217940020', name: 'Susan Jenkins', leader: false },
  { e164: '+13215376541', name: 'Priscilla Burns', leader: false },
  { e164: '+12532323335', name: 'Tee Lane', leader: false },
  { e164: '+13866897047', name: 'Mary Whitesides', leader: false },
  { e164: '+13214746156', name: 'Kathleen Shoda', leader: false },
  { e164: '+13213602912', name: 'Jade Jordon', leader: false },
  // add all current members here
];
// ──────────────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();

async function seed() {
  // Ensure the Sync Map exists
  try {
    await client.sync.v1.services(SYNC_SID).syncMaps(MAP_NAME).fetch();
    console.log(`Map '${MAP_NAME}' already exists.`);
  } catch (_) {
    await client.sync.v1.services(SYNC_SID).syncMaps.create({ uniqueName: MAP_NAME });
    console.log(`Map '${MAP_NAME}' created.`);
  }

  for (const m of FOUNDING_MEMBERS) {
    const data = {
      name:   m.name,
      status: 'ACTIVE',
      leader: m.leader || false,
      consentLog: {
        verbalConsentTime:       NOW,
        collectedBy:             'seed script (founding member)',
        confirmationRequestTime: NOW,
        yesConfirmationTime:     NOW,
        optOutTime:              null,
      },
    };
    try {
      await client.sync.v1
        .services(SYNC_SID).syncMaps(MAP_NAME).syncMapItems(m.e164).update({ data });
      console.log(`Updated: ${m.name}`);
    } catch (_) {
      await client.sync.v1
        .services(SYNC_SID).syncMaps(MAP_NAME).syncMapItems.create({ key: m.e164, data });
      console.log(`Created: ${m.name}`);
    }
  }
  console.log('Done.');
}

seed().catch(console.error);
