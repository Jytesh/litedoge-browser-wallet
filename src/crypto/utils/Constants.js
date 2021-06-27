const liteDogeNetwork = {
  messagePrefix: '\x18LiteDoge Signed Message:\n',
  // LiteDoge doesn't seem to have bech32 yet
  bech32: null,
  bip32: {
    // data from EXT_PUBLIC_KEY
    public: 0x0488B21E,
    // data from EXT_SECRET_KEY
    private: 0x0488ADE4,
  },
  // data from PUBKEY_ADDRESS
  pubKeyHash: 0x5a,
  // data from SCRIPT_ADDRESS
  scriptHash: 0x07,
  // Seems like this should be correct
  wif: 0xab,
};
const liteDogeCurrency = {
  name: 'LiteDoge',
  networkVersion: 0x5a,
  network: liteDogeNetwork,
  privateKeyPrefix: 0xab,
  WIF_Start: '6',
  CWIF_Start: 'S',
};

const proxyWalletUrl = 'https://wallet-proxy.ldoge-wow.com';
const apiUrl = 'https://explorer.ldoge-wow.com';
const lDogeDenominator = 100000000;
const minFee = 10000000;
const ldogeLocktime = 0;
const ldogeVersion = 1;

export {
  liteDogeCurrency,
  liteDogeNetwork,
  proxyWalletUrl,
  apiUrl,
  lDogeDenominator,
  minFee,
  ldogeLocktime,
  ldogeVersion,
};
