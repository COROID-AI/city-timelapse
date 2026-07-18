import { useEra } from '../contexts/EraContext'
import { AudioContext } from '../contexts/AudioContext'
import { motion } from 'framer-motion'
import { useContext } from 'react'

export function TimelineSlider() {
  const { currentEra, setEra } = useEra()
  const { playEraSound } = useContext(AudioContext)

  const handleEraChange = (era: '1945' | '1965' | '1985' | '2005' | '2025' | '2055') => {
    setEra(era)
    playEraSound(era)
  }

  return (
    <div className="timeline-slider">
      <div className="timeline-container">
        <div className="timeline-track">
          {(['1945', '1965', '1985', '2005', '2025', '2055'] as const).map((era, index) => (
            <motion.button
              key={era}
              className={`timeline-year ${currentEra === era ? 'active' : ''}`}
              onClick={() => handleEraChange(era)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <span className="year">{era}</span>
              <span className="label">
                {{
                  '1945': 'Post-War',
                  '1965': 'Mid-Century',
                  '1985': 'Brutalist',
                  '2005': 'Modern',
                  '2025': 'Contemporary',
                  '2055': 'Future',
                }[era]}
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
}