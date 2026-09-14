import { createRoot } from 'react-dom/client'
import './game/runtimeVisualFixes.js'
import './game/removeBrokenGiants.js'
import './game/visualPolishV090.js'
import './game/gameplayV093.js'
import './game/mobileOnlineV094.js'
import './game/mobileGameplayV095.js'
import App from './App.jsx'
import './styles.css'
import { installClientLogger } from './game/clientLogger.js'

installClientLogger()
createRoot(document.getElementById('root')).render(<App />)
