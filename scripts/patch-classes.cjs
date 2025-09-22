const { GoogleAuth } = require('google-auth-library');

const ISSUER = '338800000002981228';         // <- tu issuer
const CLASSES = [
  { id: 'digital_pass_gold', color: '#DAA520' }, // GOLD dorado
  { id: 'digital_pass_blue', color: '#2350C6' }, // (opcional) BLUE azul corporativo
];

(async () => {
  try {
    const auth = new GoogleAuth({
      keyFile: './backend/keys/wallet-sa.json', // <- ruta correcta a tu JSON
      scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
    });
    const client = await auth.getClient();

    for (const { id, color } of CLASSES) {
      const url = `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass/${ISSUER}.${id}`;
      const res = await client.request({
        url,
        method: 'PATCH',
        data: { hexBackgroundColor: color },
      });
      console.log(`OK ${id} ->`, res.data.hexBackgroundColor);
    }
  } catch (e) {
    console.error('ERROR:', e.response?.data || e.message);
    process.exit(1);
  }
})();
