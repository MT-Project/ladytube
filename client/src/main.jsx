// LadyTube: 使用中のライブラリの印を通信に付ける (React が通信を始める前に。utils/library.js)
import './utils/library'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
