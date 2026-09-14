// pwaService.js - Gestão de PWA (Instalação no Windows/Mobile) e Modo Tela Cheia

let deferredPrompt = null
const listeners = new Set()

export function initPWA() {
  if (typeof window === 'undefined') return

  // Registrar Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('[PWA] Service Worker registrado:', reg.scope))
        .catch(err => console.warn('[PWA] Falha ao registrar Service Worker:', err))
    })
  }

  // Capturar evento de instalação nativo
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    notifyListeners()
  })

  // Detectar quando app foi instalado com sucesso
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notifyListeners()
    console.log('[PWA] Aplicativo instalado com sucesso!')
  })

  // Monitorar alterações de tela cheia
  document.addEventListener('fullscreenchange', notifyListeners)
  document.addEventListener('webkitfullscreenchange', notifyListeners)
}

export function subscribePWA(callback) {
  listeners.add(callback)
  callback(getPWAState())
  return () => listeners.delete(callback)
}

function notifyListeners() {
  const state = getPWAState()
  listeners.forEach(cb => cb(state))
}

export function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true
  )
}

export function isFullscreen() {
  if (typeof document === 'undefined') return false
  return Boolean(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  )
}

export function getPWAState() {
  const isInstalled = isStandalone()
  const canPrompt = Boolean(deferredPrompt)
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)
  const isFull = isFullscreen()

  return {
    isInstalled,
    canPrompt,
    isIOS,
    isFullscreen: isFull
  }
}

export async function promptInstallApp() {
  if (deferredPrompt) {
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    deferredPrompt = null
    notifyListeners()
    return outcome === 'accepted'
  }

  const { isIOS, isInstalled } = getPWAState()
  if (isInstalled) {
    alert('O Asterra RPG já está instalado como aplicativo!')
    return true
  }

  if (isIOS) {
    alert('Para instalar no iPhone/iPad:\n1. Toque no botão Compartilhar (⎋) do Safari\n2. Role para baixo e selecione "Adicionar à Tela de Início" 📲')
    return false
  }

  alert('Para instalar no Windows ou Android:\nClique no ícone de "Instalar aplicativo" (computador com seta ou +) na barra de endereços do seu navegador Chrome/Edge.')
  return false
}

export function toggleFullScreen() {
  if (typeof document === 'undefined') return

  if (!isFullscreen()) {
    const el = document.documentElement
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {})
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen()
    } else if (el.mozRequestFullScreen) {
      el.mozRequestFullScreen()
    } else if (el.msRequestFullscreen) {
      el.msRequestFullscreen()
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {})
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen()
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen()
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen()
    }
  }
}
