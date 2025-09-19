// backend/scripts/set_rtn.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PubSub } = require('@google-cloud/pubsub');

(async () => {
  try {
    console.log('[set:rtn] cwd =', process.cwd());
    console.log('[set:rtn] .env existe =', fs.existsSync(path.resolve('.env')));

    const keyPath = process.env.GOOGLE_WALLET_KEY_PATH;
    const topicName = process.env.PUBSUB_WALLET_TOPIC;

    if (!keyPath) throw new Error('Falta GOOGLE_WALLET_KEY_PATH');
    if (!topicName) throw new Error('Falta PUBSUB_WALLET_TOPIC');

    console.log('[set:rtn] GOOGLE_WALLET_KEY_PATH =', keyPath);
    console.log('[set:rtn] PUBSUB_WALLET_TOPIC =', topicName);

    const raw = fs.readFileSync(keyPath, 'utf8');
    const creds = JSON.parse(raw);
    console.log('[set:rtn] SA email =', creds.client_email);
    console.log('[set:rtn] project_id =', creds.project_id);

    const pubsub = new PubSub({
      projectId: creds.project_id,
      credentials: {
        client_email: creds.client_email,
        private_key: creds.private_key,
      },
    });

    const data = {
      kind: 'rtn-test',
      ts: new Date().toISOString(),
      sample: { member_id: 123, event: 'install' },
    };
    const dataBuffer = Buffer.from(JSON.stringify(data));
    const msgId = await pubsub.topic(topicName).publishMessage({ data: dataBuffer });

    console.log('✅ Publicado en', topicName, '→ msgId =', msgId);
    process.exit(0);
  } catch (e) {
    console.error('❌ Error publicando RTN:', e?.message || e);
    process.exit(1);
  }
})();
