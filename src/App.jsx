/** @jsxImportSource theme-ui */
import './css/App.css';
import React, { useEffect, useState } from 'react';
import $ from 'jquery';

// eslint-disable-next-line no-unused-vars
import { generateWallet, importWallet } from './crypto/utils/walletUtils';

import Wallet from './components/Wallet';

function App() {
  // eslint-disable-next-line prefer-const
  let [wallet, setWallet] = useState(undefined);

  useEffect(() => {
    $('#importWallet').on('click', () => {
      const walletPrivateKey = $('#walletPrivateKey').val();
      const importedWallet = importWallet(walletPrivateKey);
      wallet = importedWallet;
      setWallet(importedWallet);
      $('#walletImportDiv').css('display', 'none');
    });
  }, [wallet]);

  return (
    <div className="App">
      <header className="App-header">
        <img src="icon.png" className="App-logo" alt="logo" />
        <div id="walletImportDiv" sx={{ display: wallet ? 'none' : 'block' }}>
          <label htmlFor="key">
            Enter Wallet Private Key
          </label>
          <input name="key" id="walletPrivateKey" />
          <button type="submit" id="importWallet">Import</button>
        </div>
        <Wallet wallet={wallet} />
      </header>
    </div>
  );
}

export default App;
