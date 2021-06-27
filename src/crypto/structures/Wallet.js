import { getBalance, getUnspentTransactions, pushTransactionHex } from '../utils/walletProxy';
import { lDogeDenominator, ldogeLocktime, ldogeVersion, minFee } from '../utils/Constants';
import LitedogeBuilder from './lDogeBuilder';
import { InsufficientLitedoge } from './Errors'

class Wallet {
  constructor(keyPair, address, wifData) {
    this.keyPair = keyPair;
    this.pLiteDogeAddress = address;
    this.pLiteDogeWif = wifData;
  }

  get litedogeAddress() {
    return this.pLiteDogeAddress;
  }

  get litedogePubKey() {
    return this.keyPair.publicKey;
  }

  get litedogeWifPrivateKey() {
    return this.pLiteDogeWif;
  }
  /**
   * @returns {ECPairInterface}
   */
  get liteDogeKeyPair() {
    return this.keyPair;
  }

  balance() {
    return getBalance(this.litedogeAddress);
  }

  unspentTransaction() {
    return getUnspentTransactions(this.litedogeAddress);
  }
  async createPayment(receiverAddress, amount) {
    const amountInSats = Math.floor(amount * lDogeDenominator);
    const amountAndFees = amountInSats + minFee;
    const signer = this.liteDogeKeyPair;

    const unspentTransactions = this.getUnspentTransactions();
    const referencedTransactions = [];

    let totalInputAmount = 0;
    for (const unspentTransaction of unspentTransactions) {
      if (unspentTransaction.spendable) {
        totalInputAmount += Math.floor(unspentTransaction.amount * lDogeDenominator);
        referencedTransactions.push(unspentTransaction);
        // Check if there's sufficient being referenced
        if (totalInputAmount >= amountAndFees) {
          break;
        }
      }
    }
    const returnToSenderAmount = totalInputAmount - amountAndFees;

    // Has enough LiteDoges
    if (returnToSenderAmount >= 0) {
      try {
        const transactionBuilder = new LitedogeBuilder(this.janinService.litedogeCurrency.network);
        transactionBuilder.setLockTime(ldogeLocktime);
        transactionBuilder.setTimeToCurrentTime();
        transactionBuilder.setVersion(ldogeVersion);
        transactionBuilder.setLowR(false);
        // Add sources from previous transactions hash
        referencedTransactions.forEach(referencedTransaction => {
          transactionBuilder.addInput(referencedTransaction.txid, referencedTransaction.vout);
        });
        // Add output address
        transactionBuilder.addOutput(receiverAddress, amountInSats);
        // Send remaining LiteDoges back to sender address
        if (returnToSenderAmount > 0) {
          transactionBuilder.addOutput(this.litedogeAddress, returnToSenderAmount);
        }
        for (let i = 0; i < referencedTransactions.length; i++) {
          transactionBuilder.sign(i, signer);
        }
        const transaction = transactionBuilder.build();
        const transactionHex = transaction.toHex();

        return await pushTransactionHex(transactionHex);
      } catch (e) {
        console.error(e);
      }
    } else {
      throw new InsufficientLitedoge();
    }
  }
}

export default Wallet;

