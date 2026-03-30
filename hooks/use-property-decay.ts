import { useMemo } from "react"

/**
 * Hook to compute visual decay factor for properties based on last interaction time.
 * Calculates urgency and decay variables used for map styling.
 * 
 * @param lastInteractionAt ISO date string of last interaction
 * @param score match score (0-100)
 * @returns { decay: number, isUrgent: boolean }
 */
export function usePropertyDecay(lastInteractionAt?: string | null, score: number = 0) {
  return useMemo(() => {
    if (!lastInteractionAt) {
      return { decay: 0.5, isUrgent: false }
    }
    
    const now = Date.now()
    const last = new Date(lastInteractionAt).getTime()
    const ageMs = now - last
    const ageDays = ageMs / 86_400_000
    
    // Decay goes from 0 (new) to 1 (14+ days old)
    const decay = Math.min(ageDays / 14, 1)
    
    // Urgent if high match (75+) AND hasn't been touched for 7+ days
    const isUrgent = score >= 75 && ageDays >= 7
    
    return { decay, isUrgent }
  }, [lastInteractionAt, score])
}
