import { Buffer } from "buffer";
window.Buffer = Buffer;

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { SolanaWalletProvider } from "./context/WalletContext.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <SolanaWalletProvider>
        <App />
      </SolanaWalletProvider>
    </ThemeProvider>
  </React.StrictMode>
);
