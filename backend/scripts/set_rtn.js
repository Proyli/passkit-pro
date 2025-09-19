// backend/scripts/set_rtn.js
const { GoogleAuth } = require('google-auth-library');

const ISSUER_ID = process.env.GOOGLE_WALLET_ISSUER_ID || '338800000002981228';
// Topic que creaste en Pub/Sub
const TOPIC = process.env.PUBSUB_WALLET_TOPIC || 'projects/eastern-adapter-469018-m8/topics/wallet-rtn';

// Usa el mismo JSON que ya tienes en .env como GOOGLE_WALLET_KEY_PATH
const KEYFILE = process.env.GOOGLE_WALLET_KEY_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;

async function main() {
  if (!KEYFILE) throw new Error('Falta GOOGLE_WALLET_KEY_PATH o GOOGLE_APPLICATION_CREDENTIALS');
  if (!ISSUER_ID) throw new Error('Falta GOOGLE_WALLET_ISSUER_ID');

  const auth = new GoogleAuth({
    keyFile: KEYFILE,
    scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
  });

  const client = await auth.getClient();
  const url = `https://walletobjects.googleapis.com/walletobjects/v1/issuer/${ISSUER_ID}`;

  const res = await client.request({
    url,
    method: 'PATCH',
    data: { eventNotificationConfig: { topicName: TOPIC } },
  });

  console.log('RTN configurado ✅', res.status, res.data.eventNotificationConfig);
}

main().catch((e) => {
  console.error('❌ Error:', e.response?.status, e.response?.data || e.message);
  process.exit(1);
});
