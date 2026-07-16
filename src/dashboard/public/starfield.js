// Fond anime « starfield » (theme Starfleet) : etoiles subtiles, derive lente,
// scintillement, parallaxe a la souris. Theme-aware, respecte reduced-motion.
const canvas = document.getElementById('starfield')

if (canvas) {
  const ctx = canvas.getContext('2d')
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let width = 0
  let height = 0
  let stars = []
  let mouseX = 0
  let mouseY = 0
  let panX = 0
  let panY = 0

  function isDark() {
    const theme = document.documentElement.getAttribute('data-theme')
    if (theme === 'dark') return true
    if (theme === 'light') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    width = canvas.width = window.innerWidth * dpr
    height = canvas.height = window.innerHeight * dpr
    canvas.style.width = `${window.innerWidth}px`
    canvas.style.height = `${window.innerHeight}px`
    const count = Math.min(180, Math.round((window.innerWidth * window.innerHeight) / 11000))
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: (Math.random() * 1.2 + 0.3) * dpr,
      a: Math.random() * 0.5 + 0.2,
      tw: Math.random() * Math.PI * 2,
      depth: Math.random() * 0.6 + 0.2,
      vy: (Math.random() * 0.12 + 0.03) * dpr,
    }))
  }

  function draw(time) {
    ctx.clearRect(0, 0, width, height)
    panX += (mouseX - panX) * 0.05
    panY += (mouseY - panY) * 0.05
    const dark = isDark()
    for (const s of stars) {
      if (!reduce) {
        s.y += s.vy
        if (s.y > height) s.y = 0
      }
      const twinkle = reduce ? 1 : 0.6 + 0.4 * Math.sin(time * 0.002 + s.tw)
      const px = s.x + panX * s.depth * 42
      const py = s.y + panY * s.depth * 42
      ctx.beginPath()
      ctx.arc(px, py, s.r, 0, Math.PI * 2)
      ctx.fillStyle = dark
        ? `rgba(190,205,255,${s.a * twinkle})`
        : `rgba(40,55,90,${s.a * twinkle * 0.4})`
      ctx.fill()
    }
    if (!reduce) {
      requestAnimationFrame(draw)
    }
  }

  window.addEventListener('resize', resize)
  window.addEventListener('mousemove', (event) => {
    mouseX = event.clientX / window.innerWidth - 0.5
    mouseY = event.clientY / window.innerHeight - 0.5
  })

  resize()
  if (reduce) {
    draw(0)
  } else {
    requestAnimationFrame(draw)
  }
}
