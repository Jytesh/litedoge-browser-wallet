import { apiUrl, proxyWalletUrl } from './Constants';
import UnspentTransaction from '../structures/unspentTransaction';

function getBalance(address) {
  return fetch(`${apiUrl}/ext/getbalance/${address}`, {
    method: 'GET',
  }).then((x) => x.text());
}

function getUnspentTransactions(address) {
  return fetch(`${proxyWalletUrl}/addresses/${address}/unspent`, {
    method: 'GET',
  }).then((x) => x.json()).then((json) => {
    const { data } = json;
    const unspentTransactions = data.map((raw) => new UnspentTransaction(raw));
    return unspentTransactions;
  });
}

function pushTransactionHex(hex) {
  return fetch(`${proxyWalletUrl}/transactions`, {
    method: 'POST',
    body: JSON.stringify({
      transactionData: hex,
    }),
  });
}
export {
  getBalance,
  getUnspentTransactions,
  pushTransactionHex,
};
