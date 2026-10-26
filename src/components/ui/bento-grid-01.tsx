import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Lock, Smartphone, Leaf } from "lucide-react"
import { useEcoMode } from "@/hooks/useEcoMode"

function TypeTester({ animate }: { animate: boolean }) {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    if (!animate) return
    const interval = setInterval(() => {
      setScale((prev) => (prev === 1 ? 1.5 : 1))
    }, 2000)
    return () => clearInterval(interval)
  }, [animate])

  return (
    <div className="flex items-center justify-center h-full">
      <motion.span
        className="font-serif text-6xl md:text-8xl text-text-bark font-medium"
        animate={{ scale: animate ? scale : 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        Aa
      </motion.span>
    </div>
  )
}

function LayoutAnimation({ animate }: { animate: boolean }) {
  const [layout, setLayout] = useState(0)

  useEffect(() => {
    if (!animate) return
    const interval = setInterval(() => {
      setLayout((prev) => (prev + 1) % 3)
    }, 2500)
    return () => clearInterval(interval)
  }, [animate])

  const layouts = ["grid-cols-2", "grid-cols-3", "grid-cols-1"]

  return (
    <div className="h-full flex items-center justify-center">
      <motion.div
        className={`grid ${layouts[layout]} gap-1.5 w-full max-w-[140px] h-full`}
        layout
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="bg-moss/25 rounded-md h-5 w-full"
            layout
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
      </motion.div>
    </div>
  )
}

function SpeedIndicator({ animate }: { animate: boolean }) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!animate) {
      setLoading(false)
      return
    }
    const timeout = setTimeout(() => setLoading(false), 500)
    return () => clearTimeout(timeout)
  }, [animate])

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="h-10 flex items-center justify-center overflow-hidden relative w-full">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loader"
              className="h-8 w-24 bg-moss/15 rounded"
              initial={{ opacity: 0.5 }}
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              exit={{ opacity: 0, y: -20, position: 'absolute' }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          ) : (
            <motion.span
              key="text"
              initial={{ y: 20, opacity: 0, filter: "blur(5px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              className="text-3xl md:text-4xl font-sans font-medium text-text-bark"
            >
              30s
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <span className="text-sm text-text-stone">Diagnosis</span>
      <div className="w-full max-w-[120px] h-1.5 bg-moss/15 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-moss rounded-full"
          initial={{ width: 0 }}
          animate={{ width: loading ? 0 : "100%" }}
          transition={{ type: "spring", stiffness: 100, damping: 15, mass: 1 }}
        />
      </div>
    </div>
  )
}

function SecurityBadge({ animate }: { animate: boolean }) {
  const [shields, setShields] = useState([
    { id: 1, active: false },
    { id: 2, active: false },
    { id: 3, active: false }
  ])

  useEffect(() => {
    if (!animate) return
    const interval = setInterval(() => {
      setShields(prev => {
        const nextIndex = prev.findIndex(s => !s.active)
        if (nextIndex === -1) {
          return prev.map(() => ({ id: Math.random(), active: false }))
        }
        return prev.map((s, i) => i === nextIndex ? { ...s, active: true } : s)
      })
    }, 800)
    return () => clearInterval(interval)
  }, [animate])

  return (
    <div className="flex items-center justify-center h-full gap-2">
      {shields.map((shield) => (
        <motion.div
          key={shield.id}
          className={`w-12 h-12 rounded-lg flex items-center justify-center ${
            shield.active ? 'bg-moss/20' : 'bg-moss/5'
          }`}
          animate={{ scale: shield.active ? 1.1 : 1 }}
          transition={{ duration: 0.3 }}
        >
          <Lock className={`w-5 h-5 ${shield.active ? 'text-moss' : 'text-text-muted'}`} />
        </motion.div>
      ))}
    </div>
  )
}

function GlobalNetwork({ animate }: { animate: boolean }) {
  const [pulses] = useState([0, 1, 2, 3, 4])

  return (
    <div className="flex items-center justify-center h-full relative">
      <Leaf className="w-16 h-16 text-moss z-10" />
      {pulses.map((pulse) => (
        <motion.div
          key={pulse}
          className="absolute w-16 h-16 border-2 border-moss/30 rounded-full"
          initial={{ scale: 0.5, opacity: 1 }}
          animate={animate ? { scale: 3, opacity: 0 } : { scale: 1.4, opacity: 0.35 }}
          transition={{
            duration: 3,
            repeat: animate ? Infinity : 0,
            delay: pulse * 0.8,
            ease: "easeOut"
          }}
        />
      ))}
    </div>
  )
}

const cardClass =
  "oiled-teak-frame rounded-[var(--radius-lg)] p-8 flex flex-col hover:border-moss/40 transition-colors overflow-hidden"

function FeaturesSection() {
  const { shouldDisableAnimations } = useEcoMode()
  const animate = !shouldDisableAnimations

  return (
    <section className="px-4 py-12">
      <div className="max-w-7xl w-full mx-auto">
        <motion.p
          className="text-text-stone text-sm uppercase tracking-widest mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Features
        </motion.p>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 auto-rows-[minmax(200px,auto)] md:auto-rows-[200px]">
          <motion.div
            className={`md:col-span-2 md:row-span-2 ${cardClass}`}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={animate ? { scale: 1.02 } : undefined}
          >
            <div className="flex-1">
              <TypeTester animate={animate} />
            </div>
            <div className="mt-4">
              <h3 className="font-serif text-xl text-text-bark font-medium">Species ID</h3>
              <p className="text-text-stone text-sm mt-1">Photograph a leaf. Gemini names the plant.</p>
            </div>
          </motion.div>

          <motion.div
            className={`md:col-span-2 ${cardClass}`}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            whileHover={animate ? { scale: 0.98 } : undefined}
          >
            <div className="flex-1">
              <LayoutAnimation animate={animate} />
            </div>
            <div className="mt-4">
              <h3 className="font-serif text-xl text-text-bark font-medium">PhytoCards</h3>
              <p className="text-text-stone text-sm mt-1">A living collection that levels with care.</p>
            </div>
          </motion.div>

          <motion.div
            className={`md:col-span-2 md:row-span-2 ${cardClass} p-6`}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            whileHover={animate ? { scale: 1.02 } : undefined}
          >
            <div className="flex-1 flex items-center justify-center">
              <div className="relative">
                <GlobalNetwork animate={animate} />
              </div>
            </div>
            <div className="mt-auto relative z-20 rounded-lg p-2">
              <h3 className="font-serif text-xl text-text-bark flex items-center gap-2 font-medium">
                <Leaf className="w-5 h-5" />
                On-device drift
              </h3>
              <p className="text-text-stone text-sm mt-1">HSV checks stay on canvas. The photo never leaves.</p>
            </div>
          </motion.div>

          <motion.div
            className={`md:col-span-2 ${cardClass}`}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            whileHover={animate ? { scale: 0.98 } : undefined}
          >
            <div className="flex-1">
              <SpeedIndicator animate={animate} />
            </div>
            <div className="mt-4">
              <h3 className="font-serif text-xl text-text-bark font-medium">Clinic speed</h3>
              <p className="text-text-stone text-sm mt-1">A diagnosis in about half a minute.</p>
            </div>
          </motion.div>

          <motion.div
            className={`md:col-span-3 ${cardClass}`}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            whileHover={animate ? { scale: 0.98 } : undefined}
          >
            <div className="flex-1">
              <SecurityBadge animate={animate} />
            </div>
            <div className="mt-4">
              <h3 className="font-serif text-xl text-text-bark flex items-center gap-2 font-medium">
                <Lock className="w-5 h-5" />
                Your garden, your data
              </h3>
              <p className="text-text-stone text-sm mt-1">Collection lives in IndexedDB on this device.</p>
            </div>
          </motion.div>

          <motion.div
            className={`md:col-span-3 ${cardClass}`}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            whileHover={animate ? { scale: 0.98 } : undefined}
          >
            <div className="flex-1 flex items-center justify-center">
              <Smartphone className="w-16 h-16 text-moss" />
            </div>
            <div className="mt-4">
              <h3 className="font-serif text-xl text-text-bark font-medium">Pocket ready</h3>
              <p className="text-text-stone text-sm mt-1">Built for a phone in the potting shed.</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default function App() {
  return <FeaturesSection />
}
