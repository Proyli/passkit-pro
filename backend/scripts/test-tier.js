const { normalizeTier, tierFromAll, buildGoogleSaveUrl } = require('../src/routes/wallet');

function testCase(input) {
  console.log('---');
  console.log('input:', input);
  const norm = normalizeTier(input.tier, { loose: true });
  console.log('normalizeTier(tier) =>', norm);
  const final = tierFromAll({ tipoCliente: input.tipoCliente, queryTier: input.queryTier, bodyTier: input.tier });
  console.log('tierFromAll =>', final);
  try {
    const url = buildGoogleSaveUrl({ client: input.client || 'C1', campaign: input.campaign || 'CP', externalId: input.externalId || 'ext', displayName: input.name || 'Name', tier: final });
    console.log('buildGoogleSaveUrl -> tier used in URL key snippet:', url.slice(0,200));
  } catch (e) {
    console.error('buildGoogleSaveUrl error:', e.message);
  }
}

const cases = [
  { tipoCliente: 'gold', tier: '', queryTier: '' },
  { tipoCliente: 'Gold 15%', tier: '', queryTier: '' },
  { tipoCliente: 'blue', tier: '', queryTier: '' },
  { tipoCliente: '', tier: 'gold', queryTier: '' },
  { tipoCliente: '', tier: 'Gold 15%', queryTier: '' },
  { tipoCliente: '', tier: '', queryTier: 'gold' },
];

cases.forEach(testCase);
