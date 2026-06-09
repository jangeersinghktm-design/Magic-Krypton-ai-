'use client'
import { useEffect, useState } from 'react'

interface ThinkingStepsProps {
  isGenerating: boolean
  prompt: string
  type?: string
}

function getSteps(prompt: string, type: string) {
  const lower = prompt.toLowerCase()
  if (type === 'game' || lower.includes('game') || lower.includes('quiz')) {
    return [
      'Understanding the game concept and mechanics',
      'Planning the game loop and scoring system',
      'Designing the visual layout and UI elements',
      'Writing the game logic and event handlers',
      'Adding animations and visual feedback',
      'Polishing interactions and edge cases',
    ]
  }
  if (type === 'app' || lower.includes('app') || lower.includes('tool') || lower.includes('calculator')) {
    return [
      'Analyzing the app requirements',
      'Planning component structure and data flow',
      'Designing the user interface layout',
      'Building core functionality and logic',
      'Connecting all features together',
      'Optimizing for performance and usability',
    ]
  }
  return [
    'Reading and understanding your requirements',
    'Planning the page structure and sections',
    'Designing the visual hierarchy and layout',
    'Writing semantic HTML and styling',
    'Adding interactivity and animations',
    'Optimizing for mobile and performance',
  ]
}

export default function ThinkingSteps({ isGenerating, prompt, type = '' }: ThinkingStepsProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isExpanded, setIsExpanded] = useState(true)
  const [dots, setDots] = useState('')
  const steps = getSteps(prompt, type)

  useEffect(() => {
    if (!isGenerating) {
      setCurrentStep(0)
      return
    }
    setCurrentStep(0)
    setIsExpanded(true)

    const stepInterval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev < steps.length - 1) return prev + 1
        return prev
      })
    }, 2200)

    return () => clearInterval(stepInterval)
  }, [isGenerating])

  useEffect(() => {
    if (!isGenerating) return
    const dotInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.')
    }, 400)
    return () => clearInterval(dotInterval)
  }, [isGenerating])

  if (!isGenerating) return null

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px',
      marginBottom: '12px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* Spinner */}
        <div style={{
          width: '14px',
          height: '14px',
          border: '2px solid rgba(245,216,0,0.2)',
          borderTop: '2px solid #F5D800',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          flexShrink: 0,
        }} />
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', flex: 1 }}>
          Thinking{dots}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px' }}>
          {isExpanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          {steps.map((step, i) => {
            const isDone = i < currentStep
            const isCurrent = i === currentStep
            const isFuture = i > currentStep
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  opacity: isFuture ? 0.2 : 1,
                  transition: 'opacity 0.4s ease',
                }}
              >
                {/* Icon */}
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  flexShrink: 0,
                  marginTop: '1px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  background: isDone
                    ? 'rgba(0, 204, 68, 0.15)'
                    : isCurrent
                    ? 'rgba(245, 216, 0, 0.15)'
                    : 'rgba(255,255,255,0.05)',
                  border: isDone
                    ? '1px solid rgba(0,204,68,0.4)'
                    : isCurrent
                    ? '1px solid rgba(245,216,0,0.4)'
                    : '1px solid rgba(255,255,255,0.1)',
                }}>
                  {isDone ? '✓' : isCurrent ? '' : ''}
                </div>

                {/* Text */}
                <span style={{
                  fontSize: '13px',
                  lineHeight: '1.4',
                  color: isDone
                    ? 'rgba(255,255,255,0.4)'
                    : isCurrent
                    ? 'rgba(255,255,255,0.9)'
                    : 'rgba(255,255,255,0.2)',
                  fontWeight: isCurrent ? 500 : 400,
                  textDecoration: isDone ? 'line-through' : 'none',
                }}>
                  {step}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
