import { useState, useEffect, useRef } from 'react'
import { Play, Pause, AlertTriangle } from 'lucide-react'

export default function RadarLoop({ fetchFramesFn, alt, className, onFrameChange }) {
  const [frames, setFrames] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const stateRef = useRef({ frames, currentIndex })
  useEffect(() => {
    stateRef.current = { frames, currentIndex }
    if (frames[currentIndex] && onFrameChange) {
      onFrameChange(frames[currentIndex], currentIndex, frames.length)
    }
  }, [frames, currentIndex, onFrameChange])

  // Preloading utility
  const preloadImages = async (urls) => {
    return Promise.all(
      urls.map((url) => {
        return new Promise((resolve) => {
          const img = new Image()
          img.src = url
          img.onload = () => resolve(url)
          img.onerror = () => resolve(url)
        })
      })
    )
  }

  // Initial Fetch & Preload
  useEffect(() => {
    let active = true

    async function initialFetch() {
      try {
        setLoading(true)
        const data = await fetchFramesFn()
        if (!active) return
        
        if (data && data.length > 0) {
          await preloadImages(data.map(f => f.url))
          if (!active) return
          
          setFrames(data)
          setCurrentIndex(data.length - 1)
        } else {
          setFrames([])
        }
        setError(null)
      } catch (err) {
        if (!active) return
        console.error("Error loading radar loop:", err)
        setError("Failed to load radar data")
      } finally {
        if (active) setLoading(false)
      }
    }

    initialFetch()

    return () => {
      active = false
    }
  }, [fetchFramesFn])

  // Polling for updates in the background (every 5 minutes)
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const newData = await fetchFramesFn()
        if (!newData || newData.length === 0) return

        const { frames: currentFrames, currentIndex: currentIdx } = stateRef.current
        if (currentFrames.length === 0) {
          await preloadImages(newData.map(f => f.url))
          setFrames(newData)
          setCurrentIndex(newData.length - 1)
          return
        }

        const currentLatestTime = new Date(currentFrames[currentFrames.length - 1].timestamp).getTime()
        const newFrames = newData.filter(
          f => new Date(f.timestamp).getTime() > currentLatestTime
        )

        if (newFrames.length > 0) {
          await preloadImages(newFrames.map(f => f.url))
          
          const currentPlayingFrame = currentFrames[currentIdx]
          let alignedIdx = newData.findIndex(f => f.timestamp === currentPlayingFrame.timestamp)
          
          if (alignedIdx === -1) {
            alignedIdx = 0
          }
          
          setFrames(newData)
          setCurrentIndex(alignedIdx)
        }
      } catch (err) {
        console.error("Error polling radar frames:", err)
      }
    }, 5 * 60 * 1000)

    return () => clearInterval(pollInterval)
  }, [fetchFramesFn])

  // Timer loop for animation using requestAnimationFrame
  useEffect(() => {
    if (!isPlaying || frames.length < 2) return

    let animFrameId
    let lastTime = performance.now()
    const frameInterval = 300 // Speed: 300ms per frame

    const tick = (now) => {
      if (now - lastTime >= frameInterval) {
        setCurrentIndex((prev) => (prev + 1) % frames.length)
        lastTime = now
      }
      animFrameId = requestAnimationFrame(tick)
    }

    animFrameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animFrameId)
  }, [isPlaying, frames.length])

  if (loading) {
    return (
      <div className="radar-loading-container">
        <div className="radar-spinner"></div>
        <span>Preloading radar frames...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="radar-loading-container text-red-500">
        <AlertTriangle size={20} className="text-red-500" />
        <span style={{ marginTop: 8 }}>{error}</span>
      </div>
    )
  }

  if (frames.length === 0) {
    return (
      <div className="radar-loading-container">
        <span>No radar frames available</span>
      </div>
    )
  }

  const currentFrame = frames[currentIndex]

  return (
    <div className="radar-loop-wrapper">
      <div className="radar-image-overlay-container">
        <img src={currentFrame.url} alt={alt} className={className} />
        <div className="radar-sweep-overlay rain" />
      </div>

      {frames.length > 1 && (
        <div className="radar-controls-bar">
          <button 
            type="button"
            className="radar-play-btn" 
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? "Pause animation" : "Play animation"}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>
          
          <input 
            type="range" 
            min="0" 
            max={frames.length - 1} 
            value={currentIndex} 
            onChange={(e) => {
              setIsPlaying(false)
              setCurrentIndex(Number(e.target.value))
            }}
            className="radar-timeline-slider"
            title="Drag to scrub timeline"
          />
          
          <span className="radar-timeline-indicator">
            {currentIndex + 1} / {frames.length}
          </span>
        </div>
      )}
    </div>
  )
}
