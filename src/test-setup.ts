import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// findBy*/waitFor default to 1s; a busy full-suite run (20 jsdom files in
// parallel) can take several seconds to settle a render.
configure({ asyncUtilTimeout: 10_000 })

afterEach(() => {
  cleanup()
})
