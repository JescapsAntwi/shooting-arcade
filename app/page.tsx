"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface GameObject {
  x: number
  y: number
  width: number
  height: number
  speed: number
}

interface Player extends GameObject {
  color: string
}

interface Enemy extends GameObject {
  color: string
  points: number
}

interface Bullet extends GameObject {
  color: string
}

interface Explosion {
  x: number
  y: number
  radius: number
  life: number
  maxLife: number
}

export default function MiniArcadeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameLoopRef = useRef<number>()
  const keysRef = useRef<Set<string>>(new Set())

  const [gameState, setGameState] = useState<"menu" | "playing" | "gameOver">("menu")
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [lives, setLives] = useState(3)

  // Game objects
  const playerRef = useRef<Player>({
    x: 375,
    y: 520,
    width: 50,
    height: 30,
    speed: 5,
    color: "#00ff00",
  })

  const enemiesRef = useRef<Enemy[]>([])
  const bulletsRef = useRef<Bullet[]>([])
  const explosionsRef = useRef<Explosion[]>([])
  const lastEnemySpawnRef = useRef(0)
  const gameSpeedRef = useRef(1)

  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null)
  const musicGainNodeRef = useRef<GainNode | null>(null)
  const musicOscillatorsRef = useRef<OscillatorNode[]>([])
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const [audioEnabled, setAudioEnabled] = useState(false)
  const [musicVolume, setMusicVolume] = useState(0.3)
  const [sfxVolume, setSfxVolume] = useState(0.5)

  // Canvas dimensions
  const CANVAS_WIDTH = 800
  const CANVAS_HEIGHT = 600

  // Collision detection
  const checkCollision = (obj1: GameObject, obj2: GameObject): boolean => {
    return (
      obj1.x < obj2.x + obj2.width &&
      obj1.x + obj1.width > obj2.x &&
      obj1.y < obj2.y + obj2.height &&
      obj1.y + obj1.height > obj2.y
    )
  }

  // Spawn enemy with randomized properties
  const spawnEnemy = () => {
    const enemyTypes = [
      { width: 40, height: 30, speed: 1 + Math.random() * 2, color: "#ff4444", points: 10 },
      { width: 60, height: 40, speed: 0.5 + Math.random() * 1.5, color: "#ff8844", points: 20 },
      { width: 30, height: 25, speed: 2 + Math.random() * 3, color: "#ff44ff", points: 15 },
    ]

    const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)]
    const enemy: Enemy = {
      x: Math.random() * (CANVAS_WIDTH - type.width),
      y: -type.height,
      width: type.width,
      height: type.height,
      speed: type.speed * gameSpeedRef.current,
      color: type.color,
      points: type.points,
    }

    enemiesRef.current.push(enemy)
  }

  // Shoot bullet
  const shootBullet = () => {
    const player = playerRef.current
    const bullet: Bullet = {
      x: player.x + player.width / 2 - 2,
      y: player.y,
      width: 4,
      height: 15,
      speed: 10,
      color: "#ffff00",
    }
    bulletsRef.current.push(bullet)
    playShootSound()
  }

  // Add this function to create explosions
  const createExplosion = (x: number, y: number, radius: number) => {
    const explosion: Explosion = {
      x,
      y,
      radius,
      life: 20,
      maxLife: 20,
    }
    explosionsRef.current.push(explosion)
  }

  // Initialize audio
  const initializeAudio = () => {
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      musicGainNodeRef.current = audioContextRef.current.createGain()
      musicGainNodeRef.current.connect(audioContextRef.current.destination)
      musicGainNodeRef.current.gain.setValueAtTime(0, audioContextRef.current.currentTime)

      setAudioEnabled(true)
    } catch (error) {
      console.log("Audio initialization failed:", error)
    }
  }

  // Play sound effects
  const playShootSound = () => {
    if (!audioEnabled || !audioContextRef.current) return

    try {
      const oscillator = audioContextRef.current.createOscillator()
      const gainNode = audioContextRef.current.createGain()

      oscillator.type = "square"
      oscillator.frequency.setValueAtTime(800, audioContextRef.current.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(200, audioContextRef.current.currentTime + 0.1)

      gainNode.gain.setValueAtTime(sfxVolume * 0.3, audioContextRef.current.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.1)

      oscillator.connect(gainNode)
      gainNode.connect(audioContextRef.current.destination)

      oscillator.start()
      oscillator.stop(audioContextRef.current.currentTime + 0.1)
    } catch (error) {
      console.log("Shoot sound failed:", error)
    }
  }

  const playExplosionSound = () => {
    if (!audioEnabled || !audioContextRef.current) return

    try {
      const oscillator = audioContextRef.current.createOscillator()
      const gainNode = audioContextRef.current.createGain()
      const filter = audioContextRef.current.createBiquadFilter()

      oscillator.type = "sawtooth"
      oscillator.frequency.setValueAtTime(150, audioContextRef.current.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(50, audioContextRef.current.currentTime + 0.3)

      filter.type = "lowpass"
      filter.frequency.setValueAtTime(1000, audioContextRef.current.currentTime)
      filter.frequency.exponentialRampToValueAtTime(100, audioContextRef.current.currentTime + 0.3)

      gainNode.gain.setValueAtTime(sfxVolume * 0.4, audioContextRef.current.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.3)

      oscillator.connect(filter)
      filter.connect(gainNode)
      gainNode.connect(audioContextRef.current.destination)

      oscillator.start()
      oscillator.stop(audioContextRef.current.currentTime + 0.3)
    } catch (error) {
      console.log("Explosion sound failed:", error)
    }
  }

  const playEngineSound = () => {
    if (!audioEnabled || !audioContextRef.current) return

    try {
      const oscillator = audioContextRef.current.createOscillator()
      const gainNode = audioContextRef.current.createGain()

      oscillator.type = "sawtooth"
      oscillator.frequency.setValueAtTime(120 + Math.random() * 20, audioContextRef.current.currentTime)

      gainNode.gain.setValueAtTime(sfxVolume * 0.1, audioContextRef.current.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.5)

      oscillator.connect(gainNode)
      gainNode.connect(audioContextRef.current.destination)

      oscillator.start()
      oscillator.stop(audioContextRef.current.currentTime + 0.5)
    } catch (error) {
      console.log("Engine sound failed:", error)
    }
  }

  // Sunflower-inspired melody (chord progression: F - C - G - Am)
  const createSunflowerMelody = () => {
    if (!audioContextRef.current || !musicGainNodeRef.current) return

    const audioContext = audioContextRef.current
    const masterGain = musicGainNodeRef.current

    // Clear existing oscillators
    musicOscillatorsRef.current.forEach((osc) => {
      try {
        osc.stop()
      } catch (e) {
        // Oscillator might already be stopped
      }
    })
    musicOscillatorsRef.current = []

    // Chord progression frequencies (simplified)
    const chords = [
      // F major: F-A-C
      [174.61, 220.0, 261.63],
      // C major: C-E-G
      [261.63, 329.63, 392.0],
      // G major: G-B-D
      [196.0, 246.94, 293.66],
      // A minor: A-C-E
      [220.0, 261.63, 329.63],
    ]

    let chordIndex = 0
    const chordDuration = 4000 // 4 seconds per chord

    const playChord = (chordFreqs: number[], startTime: number) => {
      chordFreqs.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
        const filter = audioContext.createBiquadFilter()

        oscillator.type = index === 0 ? "sine" : "triangle"
        oscillator.frequency.setValueAtTime(freq, startTime)

        // Add subtle vibrato
        const lfo = audioContext.createOscillator()
        const lfoGain = audioContext.createGain()
        lfo.type = "sine"
        lfo.frequency.setValueAtTime(4, startTime) // 4Hz vibrato
        lfoGain.gain.setValueAtTime(2, startTime) // 2Hz depth

        lfo.connect(lfoGain)
        lfoGain.connect(oscillator.frequency)

        filter.type = "lowpass"
        filter.frequency.setValueAtTime(800, startTime)

        const baseGain = musicVolume * (index === 0 ? 0.08 : 0.04) // Bass note louder
        gainNode.gain.setValueAtTime(0, startTime)
        gainNode.gain.linearRampToValueAtTime(baseGain, startTime + 0.5)
        gainNode.gain.setValueAtTime(baseGain, startTime + chordDuration / 1000 - 0.5)
        gainNode.gain.linearRampToValueAtTime(0, startTime + chordDuration / 1000)

        oscillator.connect(filter)
        filter.connect(gainNode)
        gainNode.connect(masterGain)

        oscillator.start(startTime)
        lfo.start(startTime)
        oscillator.stop(startTime + chordDuration / 1000)
        lfo.stop(startTime + chordDuration / 1000)

        musicOscillatorsRef.current.push(oscillator)
      })
    }

    // Play chord progression
    const playProgression = () => {
      const currentTime = audioContext.currentTime
      playChord(chords[chordIndex], currentTime)
      chordIndex = (chordIndex + 1) % chords.length
    }

    // Start immediately and repeat
    playProgression()
    const intervalId = setInterval(playProgression, chordDuration)

    // Store interval for cleanup
    return intervalId
  }

  // Fade music in/out
  const fadeMusic = (targetVolume: number, duration = 2000) => {
    if (!musicGainNodeRef.current || !audioContextRef.current) return

    const currentTime = audioContextRef.current.currentTime
    const currentGain = musicGainNodeRef.current.gain.value

    musicGainNodeRef.current.gain.cancelScheduledValues(currentTime)
    musicGainNodeRef.current.gain.setValueAtTime(currentGain, currentTime)
    musicGainNodeRef.current.gain.linearRampToValueAtTime(targetVolume, currentTime + duration / 1000)
  }

  const startBackgroundMusic = () => {
    if (!audioEnabled || !audioContextRef.current) return

    try {
      // Fade in and start the melody
      fadeMusic(musicVolume * 0.6, 3000) // Fade in over 3 seconds

      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current)
      }

      fadeTimeoutRef.current = setTimeout(() => {
        createSunflowerMelody()
      }, 500) // Small delay before starting melody
    } catch (error) {
      console.log("Background music failed:", error)
    }
  }

  const stopBackgroundMusic = () => {
    if (!musicGainNodeRef.current) return

    // Fade out music
    fadeMusic(0, 1500) // Fade out over 1.5 seconds

    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current)
    }

    fadeTimeoutRef.current = setTimeout(() => {
      // Stop all oscillators after fade out
      musicOscillatorsRef.current.forEach((osc) => {
        try {
          osc.stop()
        } catch (e) {
          // Oscillator might already be stopped
        }
      })
      musicOscillatorsRef.current = []
    }, 1500)
  }

  // Update music volume when slider changes
  useEffect(() => {
    if (musicGainNodeRef.current && gameState === "playing") {
      fadeMusic(musicVolume * 0.6, 500) // Quick fade to new volume
    }
  }, [musicVolume, gameState])

  // Update game objects
  const updateGame = () => {
    const player = playerRef.current
    const enemies = enemiesRef.current
    const bullets = bulletsRef.current
    const keys = keysRef.current
    const explosions = explosionsRef.current

    // Player movement
    let isMoving = false
    if (keys.has("ArrowLeft") && player.x > 0) {
      player.x -= player.speed
      isMoving = true
    }
    if (keys.has("ArrowRight") && player.x < CANVAS_WIDTH - player.width) {
      player.x += player.speed
      isMoving = true
    }

    // Play engine sound occasionally when moving
    if (isMoving && Math.random() < 0.02) {
      playEngineSound()
    }

    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      bullets[i].y -= bullets[i].speed
      if (bullets[i].y < 0) {
        bullets.splice(i, 1)
      }
    }

    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i]
      if (!enemy) continue // Safety check

      enemy.y += enemy.speed

      // Remove enemies that are off screen
      if (enemy.y > CANVAS_HEIGHT) {
        enemies.splice(i, 1)
        continue
      }

      // Check collision with player
      if (checkCollision(player, enemy)) {
        // Create explosion at collision point
        createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 40)
        playExplosionSound()

        enemies.splice(i, 1)
        setLives((prev) => {
          const newLives = prev - 1
          if (newLives <= 0) {
            setGameState("gameOver")
            setHighScore((prev) => Math.max(prev, score))
          }
          return newLives
        })
        continue
      }

      // Check collision with bullets
      let enemyDestroyed = false
      for (let j = bullets.length - 1; j >= 0; j--) {
        const bullet = bullets[j]
        if (!bullet || !enemy) continue // Safety check

        if (checkCollision(bullet, enemy)) {
          // Create explosion at collision point
          createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 30)
          playExplosionSound()

          // Store points before removing enemy
          const enemyPoints = enemy.points
          setScore((prev) => prev + enemyPoints)

          bullets.splice(j, 1)
          enemies.splice(i, 1)
          enemyDestroyed = true
          break
        }
      }

      if (enemyDestroyed) continue
    }

    // Update explosions
    for (let i = explosions.length - 1; i >= 0; i--) {
      explosions[i].life -= 1
      if (explosions[i].life <= 0) {
        explosions.splice(i, 1)
      }
    }

    // Spawn enemies with randomized timing
    const now = Date.now()
    const spawnDelay = Math.max(500, 2000 - score * 2) // Faster spawning as score increases
    if (now - lastEnemySpawnRef.current > spawnDelay) {
      spawnEnemy()
      lastEnemySpawnRef.current = now
    }

    // Increase game speed gradually
    gameSpeedRef.current = 1 + score * 0.001
  }

  // Render game
  const render = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = "#000022"
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw space background with nebula effect
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
    gradient.addColorStop(0, "rgba(25, 25, 112, 0.2)")
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw stars background with twinkling effect
    ctx.fillStyle = "#ffffff"
    for (let i = 0; i < 150; i++) {
      const x = (i * 37 + Math.sin(Date.now() * 0.001 + i) * 10) % CANVAS_WIDTH
      const y = (i * 73 + Date.now() * 0.05) % CANVAS_HEIGHT
      const size = 0.5 + Math.sin(Date.now() * 0.003 + i * 0.7) * 1.5
      ctx.fillRect(x, y, size, size)
    }

    // Draw player spaceship
    const player = playerRef.current

    // Draw player ship body
    ctx.fillStyle = "#3366ff"
    ctx.beginPath()
    ctx.moveTo(player.x + player.width / 2, player.y)
    ctx.lineTo(player.x + player.width, player.y + player.height)
    ctx.lineTo(player.x, player.y + player.height)
    ctx.closePath()
    ctx.fill()

    // Draw ship details
    ctx.fillStyle = "#66aaff"
    ctx.fillRect(player.x + player.width / 2 - 5, player.y + 5, 10, player.height - 10)

    // Draw ship cockpit
    ctx.fillStyle = "#aaddff"
    ctx.beginPath()
    ctx.arc(player.x + player.width / 2, player.y + 10, 5, 0, Math.PI * 2)
    ctx.fill()

    // Draw ship engines
    ctx.fillStyle = "#ff6600"
    ctx.beginPath()
    ctx.moveTo(player.x + 10, player.y + player.height)
    ctx.lineTo(player.x + 15, player.y + player.height + 5)
    ctx.lineTo(player.x + 5, player.y + player.height + 5)
    ctx.closePath()
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(player.x + player.width - 10, player.y + player.height)
    ctx.lineTo(player.x + player.width - 15, player.y + player.height + 5)
    ctx.lineTo(player.x + player.width - 5, player.y + player.height + 5)
    ctx.closePath()
    ctx.fill()

    // Engine flame animation
    const flameHeight = 3 + Math.sin(Date.now() * 0.01) * 2
    ctx.fillStyle = "#ffaa00"
    ctx.beginPath()
    ctx.moveTo(player.x + 10, player.y + player.height + 5)
    ctx.lineTo(player.x + 15, player.y + player.height + 5 + flameHeight)
    ctx.lineTo(player.x + 5, player.y + player.height + 5 + flameHeight)
    ctx.closePath()
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(player.x + player.width - 10, player.y + player.height + 5)
    ctx.lineTo(player.x + player.width - 15, player.y + player.height + 5 + flameHeight)
    ctx.lineTo(player.x + player.width - 5, player.y + player.height + 5 + flameHeight)
    ctx.closePath()
    ctx.fill()

    // Draw enemies with better graphics
    enemiesRef.current.forEach((enemy) => {
      // Enemy body
      ctx.fillStyle = enemy.color

      // Different enemy types have different shapes
      if (enemy.points === 10) {
        // Standard enemy
        ctx.beginPath()
        ctx.moveTo(enemy.x + enemy.width / 2, enemy.y)
        ctx.lineTo(enemy.x + enemy.width, enemy.y + enemy.height / 2)
        ctx.lineTo(enemy.x + enemy.width / 2, enemy.y + enemy.height)
        ctx.lineTo(enemy.x, enemy.y + enemy.height / 2)
        ctx.closePath()
        ctx.fill()

        // Enemy details
        ctx.fillStyle = "#ffffff"
        ctx.beginPath()
        ctx.arc(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.width / 5, 0, Math.PI * 2)
        ctx.fill()
      } else if (enemy.points === 20) {
        // Larger enemy
        ctx.beginPath()
        ctx.moveTo(enemy.x + enemy.width / 2, enemy.y)
        ctx.lineTo(enemy.x + enemy.width, enemy.y + enemy.height / 3)
        ctx.lineTo(enemy.x + enemy.width, enemy.y + (enemy.height * 2) / 3)
        ctx.lineTo(enemy.x + enemy.width / 2, enemy.y + enemy.height)
        ctx.lineTo(enemy.x, enemy.y + (enemy.height * 2) / 3)
        ctx.lineTo(enemy.x, enemy.y + enemy.height / 3)
        ctx.closePath()
        ctx.fill()

        // Enemy details
        ctx.fillStyle = "#ffffff"
        ctx.beginPath()
        ctx.arc(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.width / 6, 0, Math.PI * 2)
        ctx.fill()

        ctx.beginPath()
        ctx.arc(enemy.x + enemy.width / 4, enemy.y + enemy.height / 3, enemy.width / 10, 0, Math.PI * 2)
        ctx.fill()

        ctx.beginPath()
        ctx.arc(enemy.x + (enemy.width * 3) / 4, enemy.y + enemy.height / 3, enemy.width / 10, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // Fast enemy
        ctx.beginPath()
        ctx.moveTo(enemy.x + enemy.width / 2, enemy.y)
        ctx.lineTo(enemy.x + enemy.width, enemy.y + enemy.height)
        ctx.lineTo(enemy.x, enemy.y + enemy.height)
        ctx.closePath()
        ctx.fill()

        // Enemy details
        ctx.fillStyle = "#ffffff"
        ctx.beginPath()
        ctx.arc(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.width / 6, 0, Math.PI * 2)
        ctx.fill()
      }
    })

    // Draw bullets with fire effect
    bulletsRef.current.forEach((bullet) => {
      // Bullet core
      ctx.fillStyle = "#ffff00"
      ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height)

      // Fire trail effect
      const gradient = ctx.createLinearGradient(
        bullet.x + bullet.width / 2,
        bullet.y + bullet.height,
        bullet.x + bullet.width / 2,
        bullet.y + bullet.height + 15,
      )
      gradient.addColorStop(0, "rgba(255, 255, 0, 0.8)")
      gradient.addColorStop(0.5, "rgba(255, 128, 0, 0.5)")
      gradient.addColorStop(1, "rgba(255, 0, 0, 0)")

      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.moveTo(bullet.x, bullet.y + bullet.height)
      ctx.lineTo(bullet.x + bullet.width, bullet.y + bullet.height)
      ctx.lineTo(bullet.x + bullet.width + 2, bullet.y + bullet.height + 15)
      ctx.lineTo(bullet.x - 2, bullet.y + bullet.height + 15)
      ctx.closePath()
      ctx.fill()
    })

    // Draw explosions
    explosionsRef.current.forEach((explosion) => {
      ctx.globalAlpha = explosion.life / explosion.maxLife

      // Inner explosion
      ctx.fillStyle = "#ffffff"
      ctx.beginPath()
      ctx.arc(explosion.x, explosion.y, explosion.radius * 0.3, 0, Math.PI * 2)
      ctx.fill()

      // Middle explosion
      ctx.fillStyle = "#ffff00"
      ctx.beginPath()
      ctx.arc(explosion.x, explosion.y, explosion.radius * 0.6, 0, Math.PI * 2)
      ctx.fill()

      // Outer explosion
      ctx.fillStyle = "#ff6600"
      ctx.beginPath()
      ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2)
      ctx.fill()

      ctx.globalAlpha = 1
    })

    // Draw UI with improved styling
    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 20px monospace"
    ctx.fillText(`Score: ${score}`, 10, 30)

    // Draw lives as mini ships
    ctx.fillText("Lives:", 10, 60)
    for (let i = 0; i < lives; i++) {
      ctx.fillStyle = "#3366ff"
      ctx.beginPath()
      ctx.moveTo(90 + i * 25, 55)
      ctx.lineTo(100 + i * 25, 65)
      ctx.lineTo(80 + i * 25, 65)
      ctx.closePath()
      ctx.fill()
    }

    ctx.fillStyle = "#ffcc00"
    ctx.fillText(`High Score: ${highScore}`, 10, 90)

    // Speed indicator with gradient
    const speedGradient = ctx.createLinearGradient(CANVAS_WIDTH - 150, 20, CANVAS_WIDTH - 50, 20)
    speedGradient.addColorStop(0, "#00ff00")
    speedGradient.addColorStop(0.5, "#ffff00")
    speedGradient.addColorStop(1, "#ff0000")
    ctx.fillStyle = speedGradient
    ctx.fillText(`Speed: ${gameSpeedRef.current.toFixed(1)}x`, CANVAS_WIDTH - 150, 30)
  }

  // Game loop
  const gameLoop = useCallback(() => {
    if (gameState === "playing") {
      updateGame()
      render()
      gameLoopRef.current = requestAnimationFrame(gameLoop)
    }
  }, [gameState, score, lives])

  // Start game
  const startGame = () => {
    setGameState("playing")
    setScore(0)
    setLives(3)
    playerRef.current.x = 375
    playerRef.current.y = 520
    enemiesRef.current.length = 0
    bulletsRef.current.length = 0
    explosionsRef.current.length = 0
    gameSpeedRef.current = 1
    lastEnemySpawnRef.current = Date.now()

    // Initialize and start audio
    if (!audioEnabled) {
      initializeAudio()
    }
    startBackgroundMusic()
  }

  // Reset game
  const resetGame = () => {
    setGameState("menu")
    explosionsRef.current = []
    stopBackgroundMusic()
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current)
    }
  }

  // Handle game over state change
  useEffect(() => {
    if (gameState === "gameOver") {
      stopBackgroundMusic()
    }
  }, [gameState])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current)
      }
      musicOscillatorsRef.current.forEach((osc) => {
        try {
          osc.stop()
        } catch (e) {
          // Oscillator might already be stopped
        }
      })
    }
  }, [])

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.code)

      if (e.code === "Space" && gameState === "playing") {
        e.preventDefault()
        shootBullet()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code)
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [gameState])

  // Start game loop when playing
  useEffect(() => {
    if (gameState === "playing") {
      gameLoopRef.current = requestAnimationFrame(gameLoop)
    }

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current)
      }
    }
  }, [gameState, gameLoop])

  // Initial render for menu
  useEffect(() => {
    if (gameState === "menu" || gameState === "gameOver") {
      render()
    }
  }, [gameState])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
      <Card className="p-6 bg-gray-800 border-gray-700">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold text-white mb-2">Space Defender</h1>
          <p className="text-gray-300 text-sm">Use ← → arrows to move, SPACE to shoot</p>
          {audioEnabled && gameState === "playing" && (
            <p className="text-yellow-400 text-xs mt-1">♪ Now Playing: Sunflower (Space Mix) ♪</p>
          )}
        </div>

        <div className="relative">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="border border-gray-600 bg-black"
          />

          {gameState === "menu" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
              <div className="text-center text-white">
                <h2 className="text-4xl font-bold mb-4">Space Defender</h2>
                <p className="mb-6 text-gray-300">
                  Defend Earth from the alien invasion!
                  <br />
                  Destroy enemies to earn points and increase difficulty.
                </p>
                <Button onClick={startGame} size="lg" className="bg-blue-600 hover:bg-blue-700 text-white">
                  Start Game
                </Button>
                {highScore > 0 && <p className="mt-4 text-yellow-400">High Score: {highScore}</p>}
              </div>
            </div>
          )}

          {gameState === "gameOver" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
              <div className="text-center text-white">
                <h2 className="text-4xl font-bold mb-4 text-red-400">Game Over</h2>
                <p className="mb-2 text-xl">Final Score: {score}</p>
                {score === highScore && score > 0 && <p className="mb-4 text-yellow-400 font-bold">New High Score!</p>}
                <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-4">
                  <Button onClick={startGame} variant="default" size="lg" className="bg-blue-600 hover:bg-blue-700">
                    Play Again
                  </Button>
                  <Button
                    onClick={resetGame}
                    variant="secondary"
                    size="lg"
                    className="bg-gray-600 hover:bg-gray-700 text-white border-gray-500"
                  >
                    Main Menu
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-gray-400 text-sm space-y-2">
          <p>Features: Randomized enemy spawning • Dynamic speed scaling • Collision detection</p>

          <div className="flex items-center justify-center space-x-4 mt-4">
            <Button onClick={() => setAudioEnabled(!audioEnabled)} variant="outline" size="sm" className="text-xs">
              {audioEnabled ? "🔊 Audio On" : "🔇 Audio Off"}
            </Button>

            {audioEnabled && (
              <>
                <div className="flex items-center space-x-2">
                  <span className="text-xs">Music:</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={musicVolume}
                    onChange={(e) => setMusicVolume(Number.parseFloat(e.target.value))}
                    className="w-16 h-1"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs">SFX:</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={sfxVolume}
                    onChange={(e) => setSfxVolume(Number.parseFloat(e.target.value))}
                    className="w-16 h-1"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
