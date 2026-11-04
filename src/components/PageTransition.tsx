import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TypographyVortexCanvas } from '@designcodeio/threeui'
import '@designcodeio/threeui/style.css'

interface PageTransitionContextType {
  triggerTransition: (to: string, title?: string) => void
}

const PageTransitionContext = React.createContext<PageTransitionContextType>({
  triggerTransition: () => {},
})

export const usePageTransition = () => React.useContext(PageTransitionContext)

export const PageTransitionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [active, setActive] = useState(false)
  const navigate = useNavigate()

  const triggerTransition = (to: string) => {
    setActive(true)
    setTimeout(() => {
      navigate(to)
      setTimeout(() => {
        setActive(false)
      }, 400)
    }, 600)
  }

  return (
    <PageTransitionContext.Provider value={{ triggerTransition }}>
      {children}
      {active && (
        <div className="fixed inset-0 z-[9999] bg-[#050505] transition-opacity duration-300">
          <div className="absolute inset-0 z-0 overflow-hidden">
            <TypographyVortexCanvas
              mode="dark"
              speed={1.20}
              ringGrowth={1.25}
              opacity={1.00}
              dissolveRadius={1.00}
              particleAmount={1.00}
              suctionDuration={900}
            />
          </div>
        </div>
      )}
    </PageTransitionContext.Provider>
  )
}
