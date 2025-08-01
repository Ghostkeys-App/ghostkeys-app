import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { IdentitySystemProvider } from './utility/identity';
import { VaultContextProvider } from './utility/vault-provider';
import './index.scss';

const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
  document.body.classList.add("dark");
}


ReactDOM.createRoot(document.getElementById('root')!).render(
  <>
    <IdentitySystemProvider>
      <VaultContextProvider>
        <App />
      </VaultContextProvider>
    </IdentitySystemProvider>
  </>,
);
