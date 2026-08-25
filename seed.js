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
  { e164: '+14045550001', name: 'Pastor Dave', leader: true  },
  { e164: '+14045550002', name: 'Alice',        leader: false },
  { e164: '+14045550003', name: 'Ben',           leader: false },
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
