import { useEffect, useMemo } from 'react'
import { useAppStore } from '../app/store'
import type { EraConfig, EraId } from '../app/types'
import { createEraSfxController } from '../lib/audio'

export function SFXController({ eraConfig, eraId }: { eraConfig: EraConfig; eraId: EraId }) {
  const { sfxEnabled, reduceMotion } = useAppStore()

  const controller = useMemo(() => createEraSfxController(), [])

  useEffect(() => {
    controller.setEnabled(Boolean(sfxEnabled) && !reduceMotion)
  }, [controller, sfxEnabled, reduceMotion])

  useEffect(() => {
    controller.setEra(eraConfig, eraId)
  }, [controller, eraConfig, eraId])

  return null
}
