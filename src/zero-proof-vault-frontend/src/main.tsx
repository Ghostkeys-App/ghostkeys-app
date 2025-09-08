import ReactDOM from 'react-dom/client';
import App from './App';
import { IdentitySystemProvider } from './utility/identity';
import './index.scss';
import { APIContextProvider } from './utility/api/APIContext';
import {VaultContextProvider} from "./utility/vault-provider";
import {ToastProvider} from "./utility/toast";

ReactDOM.createRoot(document.getElementById('root')!).render(
  <>
    <IdentitySystemProvider>
      <APIContextProvider>
         <VaultContextProvider>
           <ToastProvider>
               <App />
           </ToastProvider>
         </VaultContextProvider>
      </APIContextProvider>
    </IdentitySystemProvider>
  </>,
);
