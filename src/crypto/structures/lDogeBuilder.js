import {payments, TransactionBuilder, crypto, script} from 'bitcoinjs-lib';
import {LitedogeTransaction} from './lDogeTransaction';
import LitedogeBufferutils from '../utils/bufferUtils';
import * as bs58check from 'bs58check';

import {multisig} from 'bitcoinjs-lib/src/templates/multisig';
import nullData from 'bitcoinjs-lib/src/templates/nulldata';
import pubKey from 'bitcoinjs-lib/src/templates/pubkey';
import pubKeyHash from 'bitcoinjs-lib/src/templates/pubkeyhash';
import scriptHash from 'bitcoinjs-lib/src/templates/scripthash';
import witnessCommitment from 'bitcoinjs-lib/src/templates/witnesscommitment';
import witnessPubKeyHash from 'bitcoinjs-lib/src/templates/witnesspubkeyhash';
import witnessScriptHash from 'bitcoinjs-lib/src/templates/witnessscripthash';

const Sighash = {
  SIGHASH_ALL : 1,
  SIGHASH_NONE : 2,
  SIGHASH_SINGLE : 3,
  SIGHASH_ANYONECANPAY : 128,
}


const SCRIPT_TYPES = {
    P2MS: 'multisig',
    NONSTANDARD: 'nonstandard',
    NULLDATA: 'nulldata',
    P2PK: 'pubkey',
    P2PKH: 'pubkeyhash',
    P2SH: 'scripthash',
    P2WPKH: 'witnesspubkeyhash',
    P2WSH: 'witnessscripthash',
    WITNESS_COMMITMENT: 'witnesscommitment',
};


export default class LitedogeBuilder extends TransactionBuilder {
  network;
  litedogeTransaction;
  previousTransactionSet = {};
  inputs = [];

  constructor(network) {
    super(network);
      this.litedogeTransaction = new LitedogeTransaction();
  }

  setLockTime(locktime) {
    this.litedogeTransaction.locktime = locktime;
  }

  setVersion(version) {
    this.litedogeTransaction.version = version;
  }

  addInput(txHash, vout, sequence, prevOutScript) {
    let value;
    const txBuffer = LitedogeBufferutils.reverseBuffer(Buffer.from(txHash, 'hex'));

    return this.addInputUnsafe(txBuffer, vout, sequence, prevOutScript, value);
  }

  addOutput(publicHash, value) {
    const scriptPubKey = toOutputScript(publicHash, this.network);
    return this.litedogeTransaction.addOutput(scriptPubKey, value);
  }

  sign(
    signParams,
    keyPair,
    redeemScript,
    hashType,
  ) {
    this.trySign(
      this.getSigningData(
        this.network,
        this.inputs,
        this.needsOutputs.bind(this),
        this.litedogeTransaction,
        signParams,
        keyPair,
        redeemScript,
        hashType,
        false,
      ),
    );
  }

  addInputUnsafe(txHash,
                         vout,
                         sequence,
                         prevOutScript,
                         value,
                         scriptSig,
                         inputScript) {
    const prevTxOut = txHash.toString('hex') + ':' + vout;
    if (this.previousTransactionSet[prevTxOut] !== undefined) {
      throw new Error('Duplicate TxOut: ' + prevTxOut);
    }
    let input= {};
    // derive what we can from the scriptSig
    if (inputScript !== undefined) {
      input = this.expandInput(inputScript);
    }
    // if an input value was given, retain it
    if (value !== undefined) {
      input.value = value;
    }
    // derive what we can from the previous transactions output script
    if (!input.prevOutScript && prevOutScript) {
      let prevOutType;
      if (!input.pubkeys && !input.signatures) {
        const expanded = this.expandOutput(prevOutScript);
        if (expanded.pubkeys) {
          input.pubkeys = expanded.pubkeys;
          input.signatures = expanded.signatures;
        }
        prevOutType = expanded.type;
      }
      input.prevOutScript = prevOutScript;
      input.prevOutType = prevOutType || output(prevOutScript);
    }
    const vin = this.litedogeTransaction.addInput(
      txHash,
      vout,
      sequence,
      scriptSig,
    );
    this.inputs[vin] = input;
    this.previousTransactionSet[prevTxOut] = true;
    return vin;
  }

  expandInput(scriptSig, type, scriptPubKey) {
    if (scriptSig.length === 0) {
      return {};
    }
    if (!type) {
      let ssType = input(scriptSig);
      if (ssType === SCRIPT_TYPES.NONSTANDARD) {
        ssType = undefined;
      }
      type = ssType;
    }
    // eslint-disable-next-line default-case
    switch (type) {
      case SCRIPT_TYPES.P2PKH: {
        const {output, pubkey, signature} = payments.p2pkh({
          input: scriptSig,
          network: this.network,
        });
        return {
          prevOutScript: output,
          prevOutType: SCRIPT_TYPES.P2PKH,
          pubkeys: [pubkey],
          signatures: [signature],
        };
      }
      case SCRIPT_TYPES.P2PK: {
        const {signature} = payments.p2pk({
          input: scriptSig,
          network: this.network,
        });
        return {
          prevOutType: SCRIPT_TYPES.P2PK,
          pubkeys: [undefined],
          signatures: [signature],
        };
      }
    }
    return {
      prevOutType: SCRIPT_TYPES.NONSTANDARD,
      prevOutScript: scriptSig,
    };
  }

  expandOutput(outputScript, ourPubKey) {
    const type = output(outputScript);
    // eslint-disable-next-line default-case
    switch (type) {
      case SCRIPT_TYPES.P2PKH: {
        if (!ourPubKey) {
          return {type};
        }
        // does our hash160(pubKey) match the output scripts?
        const pkh1 = payments.p2pkh({
          output: outputScript,
          network: this.network,
        }).hash;
        const pkh2 = crypto.hash160(ourPubKey);
        if (!pkh1.equals(pkh2)) {
          return {type};
        }
        return {
          type,
          pubkeys: [ourPubKey],
          signatures: [undefined],
        };
      }
      case SCRIPT_TYPES.P2PK: {
        const p2pk = payments.p2pk({
          output: outputScript,
          network: this.network,
        });
        return {
          type,
          pubkeys: [p2pk.pubkey],
          signatures: [undefined],
        };
      }
    }
    return {type};
  }

  trySign({
                    input,
                    ourPubKey,
                    keyPair,
                    signatureHash,
                    hashType,
                    useLowR,
                  }) {
    // enforce in order signing of public keys
    let signed = false;
    for (const [i, pubKey] of input.pubkeys.entries()) {
      if (!ourPubKey.equals(pubKey)) {
        continue;
      }
      if (input.signatures[i]) {
        throw new Error('Signature already exists');
      }
      const signature = keyPair.sign(signatureHash, useLowR);
      input.signatures[i] = script.signature.encode(signature, hashType);
      signed = true;
    }
    if (!signed) {
      throw new Error('Key pair cannot sign for this input');
    }
  }

  getSigningData(
    network,
    inputs,
    needsOutputs,
    tx,
    signParams,
    keyPair,
    redeemScript,
    hashType = Sighash.SIGHASH_ALL,
    useLowR,
  ) {
    const vin = signParams;
    if (keyPair === undefined) {
      throw new Error('sign requires keypair');
    }
    // TODO: remove keyPair.network matching in 4.0.0
    if (keyPair.network && keyPair.network !== network) {
      throw new TypeError('Inconsistent network');
    }
    if (!inputs[vin]) {
      throw new Error('No input at index: ' + vin);
    }
    if (needsOutputs(hashType)) {
      throw new Error('Transaction needs outputs');
    }
    const input = inputs[vin];
    // if redeemScript was previously provided, enforce consistency
    if (
      input.redeemScript !== undefined &&
      redeemScript &&
      !input.redeemScript.equals(redeemScript)
    ) {
      throw new Error('Inconsistent redeemScript');
    }
    const ourPubKey =
      keyPair.publicKey || (keyPair.getPublicKey && keyPair.getPublicKey());
    if (!this.canSign(input)) {
      if (!this.canSign(input)) {
        const prepared = this.prepareInput(
          input,
          ourPubKey,
          redeemScript,
        );
        // updates inline
        Object.assign(input, prepared);
      }
      if (!this.canSign(input)) {
        throw Error(input.prevOutType + ' not supported');
      }
    }
    // ready to sign
    const signatureHash = tx.hashForSignature(vin, input.signScript, hashType);
    return {
      input,
      ourPubKey,
      keyPair,
      signatureHash,
      hashType,
      useLowR: !!useLowR,
    };
  }

  setTime(time) {
    this.litedogeTransaction.time = time;
  }

  setTimeToCurrentTime() {
    this.setTime(Math.floor(Date.now() / 1000));
  }

  build() {
    if (!this.litedogeTransaction.inputs.length) {
      throw new Error('Transaction has no inputs');
    }
    if (!this.litedogeTransaction.outputs.length) {
      throw new Error('Transaction has no outputs');
    }

    const tx = this.litedogeTransaction.litedogeClone();
    // create script signatures from inputs
    this.inputs.forEach((input, i) => {
      if (!input.prevOutType) {
        throw new Error('Transaction is not complete');
      }
      const result = this.paymentBuild(input.prevOutType, input);
      if (!result) {
        if (input.prevOutType === SCRIPT_TYPES.NONSTANDARD) {
          throw new Error('Unknown input type');
        }
        throw new Error('Not enough information');
      }
      tx.setInputScript(i, result.input);
    });
    return tx;
  }

  paymentBuild(type, input) {
    const pubkeys = input.pubkeys || [];
    const signatures = input.signatures || [];
    // eslint-disable-next-line default-case
    switch (type) {
      case SCRIPT_TYPES.P2PKH: {
        if (pubkeys.length === 0) {
          break;
        }
        if (signatures.length === 0) {
          break;
        }
        return payments.p2pkh({pubkey: pubkeys[0], signature: signatures[0], network: this.network});
      }
      case SCRIPT_TYPES.P2WPKH: {
        if (pubkeys.length === 0) {
          break;
        }
        if (signatures.length === 0) {
          break;
        }
        return payments.p2wpkh({pubkey: pubkeys[0], signature: signatures[0], network: this.network});
      }
      case SCRIPT_TYPES.P2PK: {
        if (pubkeys.length === 0) {
          break;
        }
        if (signatures.length === 0) {
          break;
        }
        return payments.p2pk({signature: signatures[0], network: this.network});
      }
      case SCRIPT_TYPES.P2SH: {
        const redeem = this.paymentBuild(input.redeemScriptType, input);
        if (!redeem) {
          return;
        }
        return payments.p2sh({
          redeem: {
            output: redeem.output || input.redeemScript,
            input: redeem.input,
          },
          network: this.network,
        });
      }
    }
  }

  canSign(input) {
    return (
      input.signScript !== undefined &&
      input.signType !== undefined &&
      input.pubkeys !== undefined &&
      input.signatures !== undefined &&
      input.signatures.length === input.pubkeys.length &&
      input.pubkeys.length > 0
    );
  }

  prepareInput(input, ourPubKey, redeemScript) {
    const prevOutScript = payments.p2pkh({pubkey: ourPubKey, network: this.network}).output;
    return {
      prevOutType: SCRIPT_TYPES.P2PKH,
      prevOutScript,
      signScript: prevOutScript,
      signType: SCRIPT_TYPES.P2PKH,
      pubkeys: [ourPubKey],
      signatures: [undefined],
    };
  }

  needsOutputs(signingHashType) {
    if (signingHashType === Sighash.SIGHASH_ALL) {
      return this.litedogeTransaction.outputs.length === 0;
    }
    // if inputs are being signed with SIGHASH_NONE, we don't strictly need outputs
    // .build() will fail, but .buildIncomplete() is OK
    return (
      this.litedogeTransaction.outputs.length === 0 &&
      this.inputs.some(input => {
        if (!input.signatures) {
          return false;
        }
        return input.signatures.some(signature => {
          if (!signature) {
            return false;
          } // no signature, no issue
          const hashType = this.signatureHashType(signature);
          // tslint:disable-next-line:no-bitwise
          if (hashType & Sighash.SIGHASH_NONE) {
            return false;
          } // SIGHASH_NONE doesn't care about outputs
          return true; // SIGHASH_* does care
        });
      })
    );
  }

  signatureHashType(buffer) {
    return buffer.readUInt8(buffer.length - 1);
  }
}

function output(outputScript) {
    if (witnessPubKeyHash.output.check(outputScript)) {
      return SCRIPT_TYPES.P2WPKH;
    }
    if (witnessScriptHash.output.check(outputScript)) {
      return SCRIPT_TYPES.P2WSH;
    }
    if (pubKeyHash.output.check(outputScript)) {
      return SCRIPT_TYPES.P2PKH;
    }
    if (scriptHash.output.check(outputScript)) {
      return SCRIPT_TYPES.P2SH;
    }
    // XXX: optimization, below functions .decompile before use
    const chunks = script.decompile(outputScript);
    if (!chunks) {
      throw new TypeError('Invalid script');
    }
    if (multisig.output.check(chunks)) {
      return SCRIPT_TYPES.P2MS;
    }
    if (pubKey.output.check(chunks)) {
      return SCRIPT_TYPES.P2PK;
    }
    if (witnessCommitment.output.check(chunks)) {
      return SCRIPT_TYPES.WITNESS_COMMITMENT;
    }
    if (nullData.output.check(chunks)) {
      return SCRIPT_TYPES.NULLDATA;
    }
    return SCRIPT_TYPES.NONSTANDARD;
}
  
function input(inputScript) {
    // XXX: optimization, below functions .decompile before use
    const chunks = script.decompile(inputScript);
    if (!chunks) {
      throw new TypeError('Invalid script');
    }
    if (pubKeyHash.input.check(chunks)) {
      return SCRIPT_TYPES.P2PKH;
    }
    if (scriptHash.input.check(chunks)) {
      return SCRIPT_TYPES.P2SH;
    }
    if (multisig.input.check(chunks)) {
      return SCRIPT_TYPES.P2MS;
    }
    if (pubKey.input.check(chunks)) {
      return SCRIPT_TYPES.P2PK;
    }
    return SCRIPT_TYPES.NONSTANDARD;
}

function toOutputScript(address, network) {
    let decodeBase58;
    try {
        decodeBase58 = fromBase58Check(address);
    } catch (e) {
    }
    if (decodeBase58) {
        if (decodeBase58.version === network.pubKeyHash) {
        return payments.p2pkh({hash: decodeBase58.hash}).output;
        }
        if (decodeBase58.version === network.scriptHash) {
        return payments.p2sh({hash: decodeBase58.hash}).output;
        }
    }
    throw new Error(address + ' has no matching Script');
}

function fromBase58Check(address) {
    const payload = bs58check.decode(address);
    if (payload.length < 21) {
        throw new TypeError(address + ' is too short');
    }
    if (payload.length > 21) {
        throw new TypeError(address + ' is too long');
    }
    const version = payload.readUInt8(0);
    const hash = payload.slice(1);
    return {version, hash};
}