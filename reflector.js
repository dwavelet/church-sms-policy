// Twilio Function: /reflector
// Deploy this as a Function in a Twilio Functions Service.
// Attach the members.json file to the same Service as a private Asset.
// Point your Twilio number's "A message comes in" webhook at this Function's URL.

exports.handler = function (context, event, callback) {
  const twilioClient = context.getTwilioClient();

  // Load the roster from the attached Asset (members.json)
  const assetPath = Runtime.getAssets()['/members.json'].path;
  const members = require(assetPath).members;

  const groupNumber = event.To;      // your Twilio number (the "group" number)
  const fromNumber = normalize(event.From);
  const bodyText = (event.Body || '').trim();

  const sender = members.find((m) => normalize(m.phone) === fromNumber);

  const twiml = new Twilio.twiml.MessagingResponse();

  const keyword = bodyText.toUpperCase();

  // JOIN — unknown number opts in
  if (!sender && keyword === 'JOIN') {
    twiml.message(
      'Sisters Bible Study Group: Your request to join has been received. ' +
      'The group leader will add you shortly. Msg & data rates may apply. Reply STOP to cancel.'
    );
    // Notify the leader
    const leader = members.find((m) => m.leader === true);
    if (leader) {
      twilioClient.messages.create({
        to: leader.phone,
        from: groupNumber,
        body: `New JOIN request from ${fromNumber}. Add them to members.json and redeploy.`,
      });
    }
    return callback(null, twiml);
  }

  // STOP — Twilio handles opt-out automatically, but notify leader to update roster
  if (sender && keyword === 'STOP') {
    const leader = members.find((m) => m.leader === true);
    if (leader) {
      twilioClient.messages.create({
        to: leader.phone,
        from: groupNumber,
        body: `${sender.name} (${fromNumber}) replied STOP. Remove them from members.json and redeploy.`,
      });
    }
    return callback(null, twiml);
  }

  if (!sender) {
    twiml.message(
      'Sisters Bible Study Group: This number is not registered. ' +
      'Text JOIN to this number to request access.'
    );
    return callback(null, twiml);
  }

  if (!bodyText) {
    return callback(null, twiml);
  }

  const recipients = members.filter((m) => normalize(m.phone) !== fromNumber);
  const outboundText = `${sender.name}: ${bodyText}`;

  const sends = recipients.map((r) =>
    twilioClient.messages.create({
      to: r.phone,
      from: groupNumber,
      body: outboundText,
    })
  );

  Promise.all(sends)
    .then(() => callback(null, twiml))
    .catch((err) => {
      console.error('Reflector send error:', err);
      callback(err);
    });

  // Normalize to last 10 digits so formatting differences
  // (+1, dashes, spaces, parens) never cause a false non-match.
  function normalize(num) {
    return (num || '').replace(/\D/g, '').slice(-10);
  }
};
