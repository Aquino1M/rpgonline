import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import './tablet.css'
import './mobileTabletV2.css'
import { installClientLogger } from './game/clientLogger.js'
import { initPWA } from './game/pwaService.js'
/* multiplayer-v3-global-lobby */
try { localStorage.setItem('shadow-ascension-last-lobby','asterra-global') } catch {}

installClientLogger()
initPWA()
createRoot(document.getElementById('root')).render(<App />)
