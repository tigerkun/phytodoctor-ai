import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Lock, Smartphone, Globe, Leaf, Camera } from "lucide-react"
import { useEcoMode } from "@/hooks/useEcoMode"
import { usePageTransition } from "@/components/home/PageTransitionContext"

const easeOut = [0.16, 1, 0.3, 1] as const
const tile =
  "bg-[var(--bg-glass)] backdrop-blur-sm border border-[var(--border-light)] rounded-[var(--radius-md)] p-6 md:p-8 flex flex-col text-left hover:border-[var(--moss)]/35 transition-colors overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moss)] focus-visible:ring-offset-2"

function PlantDoctorIllustration({ animate }: { animate: boolean }) {
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    if (!animate) return
    const interval = setInterval(() => {
      setPulse((prev) => !prev)
    }, 2000)
    return () => clearInterval(interval)
  }, [animate])

  return (
    <div className="flex items-center justify-center h-full relative">
      <div className="relative flex items-center justify-center w-28 h-28 rounded-full bg-[var(--moss)]/10 border border-[var(--moss)]/25">
        <motion.div
          animate={animate ? { scale: pulse ? 1.08 : 0.95 } : { scale: 1 }}
          transition={{ duration: 1.2, ease: easeOut }}
          className="flex items-center justify-center"
        >
          <Leaf className="w-14 h-14 text-[var(--moss)]" aria-hidden="true" />
        </motion.div>
        {animate && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-[var(--moss)]/30 pointer-events-none"
            animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>
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
        layout={animate}
        transition={{ duration: 0.5, ease: easeOut }}
      >
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="bg-[var(--moss)]/25 rounded-md h-5 w-full"
            layout={animate}
            transition={{ duration: 0.5, ease: easeOut }}
          />
        ))}
      </motion.div>
    </div>
  )
}

function SpeedIndicator({ animate }: { animate: boolean }) {
  const [loading, setLoading] = useState(animate)

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
              className="h-8 w-24 bg-[var(--moss)]/15 rounded"
              initial={{ opacity: 0.5 }}
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              exit={{ opacity: 0, y: -20, position: "absolute" }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          ) : (
            <motion.span
              key="text"
              initial={animate ? { y: 20, opacity: 0, filter: "blur(5px)" } : false}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              className="text-3xl md:text-4xl font-sans font-medium text-[var(--text-bark)]"
            >
              30s
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <span className="text-sm text-[var(--text-stone)]">Diagnosis time</span>
      <div className="w-full max-w-[120px] h-1.5 bg-[var(--moss)]/15 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-[var(--moss)] rounded-full"
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
    { id: 1, active: true },
    { id: 2, active: true },
    { id: 3, active: true },
  ])

  useEffect(() => {
    if (!animate) {
      setShields([
        { id: 1, active: true },
        { id: 2, active: true },
        { id: 3, active: true },
      ])
      return
    }
    setShields([
      { id: 1, active: false },
      { id: 2, active: false },
      { id: 3, active: false },
    ])
    const interval = setInterval(() => {
      setShields((prev) => {
        const nextIndex = prev.findIndex((s) => !s.active)
        if (nextIndex === -1) {
          return prev.map((s) => ({ ...s, active: false }))
        }
        return prev.map((s, i) => (i === nextIndex ? { ...s, active: true } : s))
      })
    }, 800)
    return () => clearInterval(interval)
  }, [animate])

  return (
    <div className="flex items-center justify-center h-full gap-2">
      {shields.map((shield) => (
        <motion.div
          key={shield.id}
          className={`w-12 h-12 rounded-[var(--radius-sm)] flex items-center justify-center ${
            shield.active ? "bg-[var(--moss)]/20" : "bg-[var(--moss)]/5"
          }`}
          animate={{ scale: shield.active ? 1.1 : 1 }}
          transition={{ duration: 0.3 }}
        >
          <Lock className={`w-5 h-5 ${shield.active ? "text-[var(--moss)]" : "text-[var(--text-muted)]"}`} aria-hidden="true" />
        </motion.div>
      ))}
    </div>
  )
}

function GlobalNetwork({ animate }: { animate: boolean }) {
  const pulses = [0, 1, 2, 3, 4]

  return (
    <div className="flex items-center justify-center h-full relative overflow-hidden">
      <Globe className="w-16 h-16 text-[var(--moss)] z-10" aria-hidden="true" />
      {animate && pulses.map((pulse) => (
        <motion.div
          key={pulse}
          className="absolute w-16 h-16 border-2 border-[var(--moss)]/30 rounded-full pointer-events-none"
          initial={{ scale: 0.5, opacity: 1 }}
          animate={{ scale: 3, opacity: 0 }}
          transition={{
            duration: 3,
            repeat: Infinity,
            delay: pulse * 0.8,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  )
}

function FeaturesSection() {
  const { shouldDisableAnimations } = useEcoMode()
  const { transitionTo } = usePageTransition()
  const animate = !shouldDisableAnimations

  return (
    <section className="px-4 py-10" aria-label="Keeper tools">
      <div className="max-w-7xl w-full mx-auto">
        <motion.h2
          className="text-[var(--text-stone)] text-[10px] font-black uppercase tracking-[0.22em] mb-6"
          initial={animate ? { opacity: 0, y: 20 } : false}
          whileInView={animate ? { opacity: 1, y: 0 } : undefined}
          viewport={{ once: true }}
        >
          Keeper tools
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 auto-rows-[minmax(200px,auto)]">
          <motion.button
            type="button"
            onClick={() => transitionTo("/lab", "Botanical Lab")}
            aria-label="Plant Doctor — Photograph a leaf. Gemini names the species and writes the care plan."
            className={`md:col-span-2 md:row-span-2 ${tile} cursor-pointer`}
            initial={animate ? { opacity: 0, y: 30 } : false}
            whileInView={animate ? { opacity: 1, y: 0 } : undefined}
            viewport={{ once: true }}
            whileHover={animate ? { scale: 1.02 } : undefined}
          >
            <div className="flex-1">
              <PlantDoctorIllustration animate={animate} />
            </div>
            <div className="mt-4">
              <span className="font-serif text-xl text-[var(--text-bark)] font-medium flex items-center gap-2">
                <Leaf className="w-5 h-5 text-[var(--moss)]" aria-hidden="true" />
                Plant Doctor
              </span>
              <p className="text-[var(--text-stone)] text-sm mt-1">
                Photograph a leaf. Gemini names the species and writes the care plan.
              </p>
            </div>
          </motion.button>

          <motion.button
            type="button"
            onClick={() => transitionTo("/collection", "Sim Lab")}
            aria-label="Collection — PhytoCards that rearrange as the garden grows."
            className={`md:col-span-2 ${tile} cursor-pointer`}
            initial={animate ? { opacity: 0, y: 30 } : false}
            whileInView={animate ? { opacity: 1, y: 0 } : undefined}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            whileHover={animate ? { scale: 0.98 } : undefined}
          >
            <div className="flex-1">
              <LayoutAnimation animate={animate} />
            </div>
            <div className="mt-4">
              <span className="font-serif text-xl text-[var(--text-bark)] font-medium block">Collection</span>
              <p className="text-[var(--text-stone)] text-sm mt-1">PhytoCards that rearrange as the garden grows.</p>
            </div>
          </motion.button>

          <motion.button
            type="button"
            onClick={() => transitionTo("/lab", "Botanical Lab")}
            aria-label="Weather-aware care — Watering advice follows your city, not a default climate."
            className={`md:col-span-2 md:row-span-2 ${tile} cursor-pointer`}
            initial={animate ? { opacity: 0, y: 30 } : false}
            whileInView={animate ? { opacity: 1, y: 0 } : undefined}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            whileHover={animate ? { scale: 1.02 } : undefined}
          >
            <div className="flex-1 flex items-center justify-center">
              <div className="relative">
                <GlobalNetwork animate={animate} />
              </div>
            </div>
            <div className="mt-auto relative z-20 bg-[var(--bg-glass)] backdrop-blur-sm rounded-[var(--radius-sm)] p-2 -mx-2">
              <span className="font-serif text-xl text-[var(--text-bark)] flex items-center gap-2 font-medium">
                <Globe className="w-5 h-5 text-[var(--moss)]" aria-hidden="true" />
                Weather-aware care
              </span>
              <p className="text-[var(--text-stone)] text-sm mt-1">
                Watering advice follows your city, not a default climate.
              </p>
            </div>
          </motion.button>

          <motion.button
            type="button"
            onClick={() => transitionTo("/lab", "Botanical Lab")}
            aria-label="Fast scan — A diagnosis in about half a minute."
            className={`md:col-span-2 ${tile} cursor-pointer`}
            initial={animate ? { opacity: 0, y: 30 } : false}
            whileInView={animate ? { opacity: 1, y: 0 } : undefined}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            whileHover={animate ? { scale: 0.98 } : undefined}
          >
            <div className="flex-1">
              <SpeedIndicator animate={animate} />
            </div>
            <div className="mt-4">
              <span className="font-serif text-xl text-[var(--text-bark)] font-medium flex items-center gap-2">
                <Camera className="w-5 h-5 text-[var(--moss)]" aria-hidden="true" />
                Fast scan
              </span>
              <p className="text-[var(--text-stone)] text-sm mt-1">A diagnosis in about half a minute.</p>
            </div>
          </motion.button>

          <motion.button
            type="button"
            onClick={() => transitionTo("/privacy", "Privacy")}
            aria-label="On-device drift — Check-in photos stay in the browser. HSV comparison never leaves the canvas."
            className={`md:col-span-3 ${tile} cursor-pointer`}
            initial={animate ? { opacity: 0, y: 30 } : false}
            whileInView={animate ? { opacity: 1, y: 0 } : undefined}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            whileHover={animate ? { scale: 0.98 } : undefined}
          >
            <div className="flex-1">
              <SecurityBadge animate={animate} />
            </div>
            <div className="mt-4">
              <span className="font-serif text-xl text-[var(--text-bark)] flex items-center gap-2 font-medium">
                <Lock className="w-5 h-5 text-[var(--moss)]" aria-hidden="true" />
                On-device drift
              </span>
              <p className="text-[var(--text-stone)] text-sm mt-1">
                Check-in photos stay in the browser. HSV comparison never leaves the canvas.
              </p>
            </div>
          </motion.button>

          <motion.div
            className={`md:col-span-3 ${tile}`}
            initial={animate ? { opacity: 0, y: 30 } : false}
            whileInView={animate ? { opacity: 1, y: 0 } : undefined}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            whileHover={animate ? { scale: 0.98 } : undefined}
          >
            <div className="flex-1 flex items-center justify-center">
              <Smartphone className="w-16 h-16 text-[var(--moss)]" aria-hidden="true" />
            </div>
            <div className="mt-4">
              <span className="font-serif text-xl text-[var(--text-bark)] font-medium block">Pocket conservatory</span>
              <p className="text-[var(--text-stone)] text-sm mt-1">The same sanctuary on a phone and a desk.</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default function BentoGrid01() {
  return <FeaturesSection />
}
