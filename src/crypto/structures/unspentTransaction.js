export default class unspentTransaction {
    constructor(options) {
        return {
            "txid": options.txid,
            "vout": options.vout,
            "address": options.address,
            "scriptPubKey": options.scriptPubKey,
            "amount": options.amount,
            "confirmations": options.confirmations,
            "spendable": options.spendable,
            "solvable": options.solvable
        }
    }
}
