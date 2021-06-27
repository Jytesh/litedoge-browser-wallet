/** @jsxImportSource theme-ui */
import React, { useEffect, useState } from 'react';
import $ from 'jquery';

const currencyFiat = 'usd';

function Wallet(props) {
  const { wallet } = props;
  const [sendMode, setSendMode] = useState(false);
  const [receiveMode, setReceiveMode] = useState(false);
  const [ldogeUSDRate, setRate] = useState(0);
  const [walletBalance, setBalance] = useState(0);
  const [ldogeAmount, setAmount] = useState(0);
  const [usdAmount, setUSDAmount] = useState(0);

  const setAmountHook = (val) => {
    const value = Math.abs(val);
    setAmount(value);
    setUSDAmount(value * ldogeUSDRate);
  };

  const setUSDAmountHook = (val) => {
    const value = Math.abs(val);
    setUSDAmount(value);
    setAmount(value / ldogeUSDRate);
  };

  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/coins/litedoge')
      .then((x) => x.json())
      .then((x) => x.market_data.current_price)
      .then((x) => {
        setRate(x[currencyFiat]);
      });
  }, [ldogeUSDRate]);

  useEffect(() => {
    wallet?.balance().then(setBalance);
  }, [wallet]);

  useEffect(() => {
    $('#send').on('click', () => {
      setSendMode(!sendMode);
    });

    $('#receive').on('click', () => {
      setReceiveMode(!receiveMode);
    });

    const receiverAddr = $('#receiverAddress');
    if (receiverAddr?.val() && ldogeAmount) {
      $('#sendAmount').attr('disabled', false).on('click', async () => {
        wallet.createPayment(receiverAddr.val(), ldogeAmount);
      });
    }
  });

  useEffect(() => {
    const inputAmount = $('#inputAmount');
    if (walletBalance >= ldogeAmount) {
      inputAmount.addClass('okay');
      inputAmount.removeClass('notokay');
    } else {
      inputAmount.addClass('notokay');
      inputAmount.removeClass('okay');
    }
  }, [ldogeAmount]);

  const show = !!wallet;
  const defaultView = !sendMode && !receiveMode;

  if (!show) return <div />;

  if (defaultView) {
    return (
      <div>
        test
        <p className="publicAddress">
          {wallet?.pLiteDogeAddress.toString()}
        </p>
        <button type="submit" id="send">
          Send
        </button>
        <button type="submit" id="receive">
          Receive
        </button>
      </div>
    );
  }

  if (receiveMode) {
    return (
      <div sx={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      }}
      >
        <p className="publicAddress">
          {wallet.pLiteDogeAddress}
        </p>
        <img src={`https://explorer.ldoge-wow.com/qr/${wallet.pLiteDogeAddress}`} sx={{ justifyContent: 'center' }} alt="scan this qr" height="300px" width="300px" />
        <button type="submit" id="receive" sx={{ flexShrink: 2 }}> Back </button>
      </div>
    );
  }

  return (
    <div sx={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    }}
    >
      <p>
        Your Balance is
        {` ${walletBalance} `}
      </p>
      <label htmlFor="address">
        Receiver Address
      </label>
      <input type="text" name="address" id="receiverAddress" />
      <label htmlFor="amount">
        Amount To send
      </label>
      <div id="inputAmount" sx={{ display: 'flex' }}>
        <div>
          Coins
          <input
            type="number"
            name="amount"
            value={ldogeAmount}
            onChange={(event) => setAmountHook(event.target.value)}
            sx={{
              flexShrink: 4,
            }}
          />
        </div>
        <div sx={{ display: 'flex', alignItems: 'center' }}>
          USD
          <input
            type="number"
            name="amount"
            value={usdAmount}
            onChange={(event) => setUSDAmountHook(event.target.value)}
            sx={{
              flexShrink: 4,
            }}
          />
        </div>
      </div>
      <button type="submit" id="sendAmount" sx={{ flexShrink: 2 }} disabled> Send </button>
      <button type="submit" id="send" sx={{ flexShrink: 2 }}> Back </button>
    </div>
  );
}
export default Wallet;
