import { describe, it, expect } from 'vitest'
import { EXAMPLES, DEFAULT_EXAMPLE_ID } from './heatmap.examples'

describe('EXAMPLES config validation', () => {
  it('all example IDs are unique', () => {
    const ids = EXAMPLES.map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('DEFAULT_EXAMPLE_ID exists in EXAMPLES', () => {
    expect(EXAMPLES.some(e => e.id === DEFAULT_EXAMPLE_ID)).toBe(true)
  })

  it('there are exactly 4 examples', () => {
    expect(EXAMPLES).toHaveLength(4)
  })

  EXAMPLES.forEach(ex => {
    describe(`"${ex.label}"`, () => {
      it('cluster weights sum to 1.0', () => {
        const sum = ex.clusters.reduce((acc, c) => acc + c.weight, 0)
        expect(sum).toBeCloseTo(1.0, 5)
      })

      it('totalPoints is positive', () => {
        expect(ex.totalPoints).toBeGreaterThan(0)
      })

      it('cols and rows are positive', () => {
        expect(ex.cols).toBeGreaterThan(0)
        expect(ex.rows).toBeGreaterThan(0)
      })

      it('all clusters have positive std', () => {
        ex.clusters.forEach(c => expect(c.std).toBeGreaterThan(0))
      })

      it('has non-empty intro and description', () => {
        expect(ex.intro.length).toBeGreaterThan(0)
        expect(ex.description.length).toBeGreaterThan(0)
      })
    })
  })
})
