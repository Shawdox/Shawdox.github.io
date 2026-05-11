declare global {
  interface Window {
    busuanzi?: {
      fetch?: () => void
    }
  }
}

const busuanziScriptId = "busuanzi-script"
const busuanziScriptSrc = "https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js"

function loadVisitorCount() {
  if (!document.getElementById("busuanzi_value_site_uv")) {
    return
  }

  const existingScript = document.getElementById(busuanziScriptId)
  if (existingScript) {
    window.busuanzi?.fetch?.()
    return
  }

  const script = document.createElement("script")
  script.id = busuanziScriptId
  script.async = true
  script.src = busuanziScriptSrc
  document.body.appendChild(script)
}

document.addEventListener("nav", loadVisitorCount)
