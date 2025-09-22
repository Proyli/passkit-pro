const { GoogleAuth } = require('google-auth-library');

(async () => {
  try {
    const auth = new GoogleAuth({
      keyFile: './backend/keys/wallet-sa.json', // ruta correcta
      scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    console.log(token.token || token);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
})();
