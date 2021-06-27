import Wallet from '../structures/Wallet';
import { ECPair, payments } from 'bitcoinjs-lib';
import { liteDogeNetwork } from './Constants';

function generateWallet() {
    const ecPairOptions = {
      network: liteDogeNetwork
    };
    const keyPair = ECPair.makeRandom(ecPairOptions);
    const { address } = payments.p2pkh({pubkey: keyPair.publicKey, network: liteDogeNetwork}, {validate: true});
    const wifKeyPair = keyPair.toWIF();

    return new Wallet(keyPair, address, wifKeyPair);
}
function importWallet(privateKey){
    const importedKeyPair = ECPair.fromWIF(privateKey, liteDogeNetwork);
    const { address } = payments.p2pkh({pubkey: importedKeyPair.publicKey, network:liteDogeNetwork}, {validate: true});

    return new Wallet(importedKeyPair, address, privateKey);
  }
export {
    generateWallet,
    importWallet
}
