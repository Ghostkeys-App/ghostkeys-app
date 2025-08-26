import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { IdentitySystemProvider } from './utility/identity';
import './index.scss';
import { APIContextProvider } from './utility/api/APIContext';
import {VaultContextProvider} from "./utility/vault-provider";
import {ToastProvider} from "./utility/toast";
import {PasswordGate} from "./components/modals/password-gate-modal";

ReactDOM.createRoot(document.getElementById('root')!).render(
  <>
    <IdentitySystemProvider>
      <APIContextProvider>
         <VaultContextProvider>
           <ToastProvider>
             {/*<PasswordGate>*/}
               <App />
             {/*</PasswordGate>*/}
           </ToastProvider>
         </VaultContextProvider>
      </APIContextProvider>
    </IdentitySystemProvider>
  </>,
);
