import logo from './logo.svg';
import './css/App.css';
// eslint-disable-next-line no-unused-vars
import { generateWallet, importWallet } from './crypto/utils/walletUtils.js';

function App() {
  const wallet = generateWallet();
  console.log(wallet);
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;