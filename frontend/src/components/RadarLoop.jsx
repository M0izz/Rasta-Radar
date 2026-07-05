import { useState, useEffect, useRef } from 'react'
import { Play, Pause, AlertTriangle } from 'lucide-react'

const formatTimestamp = (isoString) => {
  if (!isoString) return ''
  const date = new Date(isoString)
  const day = date.getDate()
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = months[date.getMonth()]
  const year = date.getFullYear()
  
  let hours = date.getHours()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  hours = hours ? hours : 12
  const minutes = String(date.getMinutes()).padStart(2, '0')
  
  return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm} IST`
}

export default function RadarLoop({ fetchFramesFn, alt, className }) {
  const [frames, setFrames] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Keep a ref to access the latest state in the async intervals/polls
  const stateRef = useRef({ frames, currentIndex })
  useEffect(() => {
    stateRef.current = { frames, currentIndex }
  }, [frames, currentIndex])

  // Preloading utility using standard Image loading Promises
  const preloadImages = async (urls) => {
    return Promise.all(
      urls.map((url) => {
        return new Promise((resolve) => {
          const img = new Image()
          img.src = url
          img.onload = () => resolve(url)
          img.onerror = () => resolve(url) // Resolve anyway so one bad image doesn't block the loop
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
          // Default to the latest frame (index N-1)
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

        // If there are new frames, preload them and append/update the loop buffer
        if (newFrames.length > 0) {
          await preloadImages(newFrames.map(f => f.url))
          
          // Re-align the currentIndex to the same timestamp so the visual doesn't jump
          const currentPlayingFrame = currentFrames[currentIdx]
          let alignedIdx = newData.findIndex(f => f.timestamp === currentPlayingFrame.timestamp)
          
          if (alignedIdx === -1) {
            // Fallback to the first frame if the current one has scrolled off the buffer
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
    const frameInterval = 200 // Time per frame: 200ms

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

  // If there's only 1 frame available, we display it statically without controls
  if (frames.length < 2) {
    return (
      <div className="radar-loop-wrapper">
        <img src={currentFrame.url} alt={alt} className={className} />
        <div className="radar-timestamp-overlay">
          {formatTimestamp(currentFrame.timestamp)}
        </div>
      </div>
    )
  }

  return (
    <div className="radar-loop-wrapper">
      <img src={currentFrame.url} alt={alt} className={className} />
      
      {/* Glassmorphic Timestamp Overlay */}
      <div className="radar-timestamp-overlay">
        {formatTimestamp(currentFrame.timestamp)} — frame {currentIndex + 1}/{frames.length}
      </div>

      {/* Modern Playback Controls */}
      <button 
        className="radar-play-btn" 
        onClick={() => setIsPlaying(!isPlaying)}
        title={isPlaying ? "Pause animation" : "Play animation"}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>
    </div>
  )
}
