import {Transaction, crypto as bcrypto, script} from 'bitcoinjs-lib';
import * as varuint from 'varuint-bitcoin';
import LitedogeBufferwriter from '../utils/bufferWriter';
import LitedogeBufferutils from '../utils/bufferUtils';

const Sighash = {
  SIGHASH_ALL : 1,
  SIGHASH_NONE : 2,
  SIGHASH_SINGLE : 3,
  SIGHASH_ANYONECANPAY : 128,
}
const EMPTY_SCRIPT = Buffer.allocUnsafe(0);
const ZERO = Buffer.from(
  '0000000000000000000000000000000000000000000000000000000000000000',
  'hex',
);
const ONE = Buffer.from(
  '0000000000000000000000000000000000000000000000000000000000000001',
  'hex',
);
const VALUE_UINT64_MAX = Buffer.from('ffffffffffffffff', 'hex');
const BLANK_OUTPUT = {
  script: EMPTY_SCRIPT,
  valueBuffer: VALUE_UINT64_MAX,
};

export class LitedogeTransaction extends Transaction {
  inputs = [];
  outputs = [];
  time = 0;

  varSliceSize(someScript) {
    const length = someScript.length;
    return varuint.encodingLength(length) + length;
  }

  addInput(hash, index, sequence = LitedogeTransaction.DEFAULT_SEQUENCE, scriptSig) {
    // Add the input and return the input's index
    return (
      this.inputs.push({
        hash,
        index,
        script: scriptSig || EMPTY_SCRIPT,
        sequence,
      }) - 1
    );
  }

  addOutput(scriptPubKey, value) {
    // Add the output and return the output's index
    return (
      this.outputs.push({
        script: scriptPubKey,
        value,
      }) - 1
    );
  }

  hashForSignature(inIndex, prevOutScript, hashType) {
    if (inIndex >= this.inputs.length) {
      return ONE;
    }
    // ignore OP_CODESEPARATOR
    const ourScript = script.compile(
      script.decompile(prevOutScript).filter(x => {
        return x !== script.OPS.OP_CODESEPARATOR;
      }),
    );
    const txTmp = this.litedogeClone();
    // SIGHASH_NONE: ignore all outputs? (wildcard payee)
    // tslint:disable-next-line:no-bitwise
    if ((hashType & 0x1f) === Sighash.SIGHASH_NONE) {
      txTmp.outputs = [];
      // ignore sequence numbers (except at inIndex)
      txTmp.inputs.forEach((input, i) => {
        if (i === inIndex) {
          return;
        }
        input.sequence = 0;
      });
      // SIGHASH_SINGLE: ignore all outputs, except at the same index?
      // tslint:disable-next-line:no-bitwise
    } else if ((hashType & 0x1f) === Sighash.SIGHASH_SINGLE) {
      // https://github.com/bitcoin/bitcoin/blob/master/src/test/sighash_tests.cpp#L60
      if (inIndex >= this.outputs.length) {
        return ONE;
      }
      // truncate outputs after
      txTmp.outputs.length = inIndex + 1;
      // "blank" outputs before
      for (let i = 0; i < inIndex; i++) {
        txTmp.outputs[i] = BLANK_OUTPUT;
      }
      // ignore sequence numbers (except at inIndex)
      txTmp.inputs.forEach((input, y) => {
        if (y === inIndex) {
          return;
        }
        input.sequence = 0;
      });
    }
    // SIGHASH_ANYONECANPAY: ignore inputs entirely?
    // tslint:disable-next-line:no-bitwise
    if (hashType & Transaction.SIGHASH_ANYONECANPAY) {
      txTmp.inputs = [txTmp.inputs[inIndex]];
      txTmp.inputs[0].script = ourScript;
      // SIGHASH_ALL: only ignore input scripts
    } else {
      // "blank" others input scripts
      txTmp.inputs.forEach(input => {
        input.script = EMPTY_SCRIPT;
      });
      txTmp.inputs[inIndex].script = ourScript;
    }
    // serialize and hash
    const buffer = Buffer.allocUnsafe(txTmp.byteLength() + 4);
    buffer.writeInt32LE(hashType, buffer.length - 4);
    txTmp.toLitedogeBuffer(buffer, 0);
    return bcrypto.hash256(buffer);
  }

  hashForWitnessV0(inIndex, prevOutScript, value, hashType) {
    let tbuffer = Buffer.from([]);
    let bufferWriter;
    let hashOutputs = ZERO;
    let hashPrevouts = ZERO;
    let hashSequence = ZERO;
    // tslint:disable-next-line:no-bitwise
    if (!(hashType & Sighash.SIGHASH_ANYONECANPAY)) {
      tbuffer = Buffer.allocUnsafe(36 * this.inputs.length);
      bufferWriter = new LitedogeBufferwriter(tbuffer, 0);
      this.inputs.forEach(txIn => {
        bufferWriter.writeSlice(txIn.hash);
        bufferWriter.writeUInt32(txIn.index);
      });
      hashPrevouts = bcrypto.hash256(tbuffer);
    }
    if (
      // tslint:disable-next-line:no-bitwise
      !(hashType & Sighash.SIGHASH_ANYONECANPAY) &&
      // tslint:disable-next-line:no-bitwise
      (hashType & 0x1f) !== Sighash.SIGHASH_SINGLE &&
      // tslint:disable-next-line:no-bitwise
      (hashType & 0x1f) !== Sighash.SIGHASH_NONE
    ) {
      tbuffer = Buffer.allocUnsafe(4 * this.inputs.length);
      bufferWriter = new LitedogeBufferwriter(tbuffer, 0);
      this.inputs.forEach(txIn => {
        bufferWriter.writeUInt32(txIn.sequence);
      });
      hashSequence = bcrypto.hash256(tbuffer);
    }
    if (
      // tslint:disable-next-line:no-bitwise
      (hashType & 0x1f) !== Sighash.SIGHASH_SINGLE &&
      // tslint:disable-next-line:no-bitwise
      (hashType & 0x1f) !== Sighash.SIGHASH_NONE
    ) {
      const txOutsSize = this.outputs.reduce((sum, output) => {
        return sum + 8 + this.varSliceSize(output.script);
      }, 0);
      tbuffer = Buffer.allocUnsafe(txOutsSize);
      bufferWriter = new LitedogeBufferwriter(tbuffer, 0);
      this.outputs.forEach(out => {
        bufferWriter.writeUInt64(out.value);
        bufferWriter.writeVarSlice(out.script);
      });
      hashOutputs = bcrypto.hash256(tbuffer);
    } else if (
      // tslint:disable-next-line:no-bitwise
      (hashType & 0x1f) === Sighash.SIGHASH_SINGLE &&
      inIndex < this.outputs.length
    ) {
      const output = this.outputs[inIndex];
      tbuffer = Buffer.allocUnsafe(8 + this.varSliceSize(output.script));
      bufferWriter = new LitedogeBufferwriter(tbuffer, 0);
      bufferWriter.writeUInt64(output.value);
      bufferWriter.writeVarSlice(output.script);
      hashOutputs = bcrypto.hash256(tbuffer);
    }
    tbuffer = Buffer.allocUnsafe(156 + this.varSliceSize(prevOutScript));
    bufferWriter = new LitedogeBufferwriter(tbuffer, 0);
    const input = this.inputs[inIndex];
    bufferWriter.writeUInt32(this.version);
    bufferWriter.writeUInt32(this.time);
    bufferWriter.writeSlice(hashPrevouts);
    bufferWriter.writeSlice(hashSequence);
    bufferWriter.writeSlice(input.hash);
    bufferWriter.writeUInt32(input.index);
    bufferWriter.writeVarSlice(prevOutScript);
    bufferWriter.writeUInt64(value);
    bufferWriter.writeUInt32(input.sequence);
    bufferWriter.writeSlice(hashOutputs);
    bufferWriter.writeUInt32(this.locktime);
    bufferWriter.writeUInt32(hashType);
    return bcrypto.hash256(tbuffer);
  }

  litedogeClone() {
    const newTx = new LitedogeTransaction();
    newTx.version = this.version;
    newTx.time = this.time;
    newTx.locktime = this.locktime;
    newTx.inputs = this.inputs.map(txIn => {
      return {
        hash: txIn.hash,
        index: txIn.index,
        script: txIn.script,
        sequence: txIn.sequence,
      };
    });
    newTx.outputs = this.outputs.map(txOut => {
      return {
        script: txOut.script,
        value: txOut.value,
      };
    });
    return newTx;
  }

  getHash() {
    return bcrypto.hash256(this.toLitedogeBuffer());
  }

  getId() {
    // transaction hash's are displayed in reverse order
    return LitedogeBufferutils.reverseBuffer(this.getHash()).toString('hex');
  }

  toBuffer(buffer, initialOffset) {
    return this.toLitedogeBuffer(buffer, initialOffset);
  }

  toHex() {
    return this.toBuffer().toString('hex');
  }

  setInputScript(index, scriptSig) {
    this.inputs[index].script = scriptSig;
  }

  byteLength() {
    return (
      4 + // version
      4 + // time
      varuint.encodingLength(this.inputs.length) +
      varuint.encodingLength(this.outputs.length) +
      this.inputs.reduce((sum, input) => {
        return sum + 40 + this.varSliceSize(input.script);
      }, 0) +
      this.outputs.reduce((sum, output) => {
        return sum + 8 + this.varSliceSize(output.script);
      }, 0) +
      4 // locktime
    );
  }

  toLitedogeBuffer(buffer, initialOffset) {
    if (!buffer) {
      buffer = Buffer.allocUnsafe(this.byteLength());
    }
    const bufferWriter = new LitedogeBufferwriter(
      buffer,
      initialOffset || 0,
    );

    bufferWriter.writeUInt32(this.version);
    bufferWriter.writeUInt32(this.time);
    bufferWriter.writeVarInt(this.inputs.length);
    this.inputs.forEach(txIn => {
      bufferWriter.writeSlice(txIn.hash);
      bufferWriter.writeUInt32(txIn.index);
      bufferWriter.writeVarSlice(txIn.script);
      bufferWriter.writeUInt32(txIn.sequence);
    });
    bufferWriter.writeVarInt(this.outputs.length);
    this.outputs.forEach(txOut => {
      if (this.isOutput(txOut)) {
        bufferWriter.writeUInt64(txOut.value);
      } else {
        bufferWriter.writeSlice(txOut.valueBuffer);
      }
      bufferWriter.writeVarSlice(txOut.script);
    });
    bufferWriter.writeUInt32(this.locktime);
    // avoid slicing unless necessary
    if (initialOffset !== undefined) {
      return buffer.slice(initialOffset, bufferWriter.offset);
    }
    return buffer;
  }

  isOutput(out) {
    return out.value !== undefined;
  }
}
