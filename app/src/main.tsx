import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import { TRPCProvider } from "@/providers/trpc"
import { LanguageProvider } from "@/providers/LanguageContext"
import { AuthProvider } from "@/providers/AuthContext"
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <TRPCProvider>
        <AuthProvider>
          <LanguageProvider>
            <App />
          </LanguageProvider>
        </AuthProvider>
      </TRPCProvider>
    </BrowserRouter>
  </StrictMode>,
)

