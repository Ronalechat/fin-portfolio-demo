/**
 * Largest-Triangle-Three-Buckets (LTTB) downsampling.
 *
 * Why LTTB? For line charts with hundreds of thousands of points, rendering
 * every point produces SVG paths that freeze the browser — yet naive uniform
 * sampling discards peaks and troughs, making the chart look "smoothed" and
 * hiding volatility. LTTB preserves the visual shape of the data by, for each
 * output bucket, picking the point that maximises the triangle area formed
 * between the previously selected point and the average of the next bucket.
 * This is a greedy approximation that runs in O(n) and is visually lossless
 * at typical screen resolutions.
 *
 * Reference: Sveinn Steinarsson (2013), "Downsampling Time Series for Visual
 * Representation", University of Iceland MSc thesis.
 */
export interface Point {
  x: number
  y: number
}

export function lttb(data: Point[], threshold: number): Point[] {
  const len = data.length

  // No downsampling needed — return original array reference (no copy overhead)
  if (threshold >= len || threshold <= 0) return data

  // Edge case: caller asks for 1 or 2 points
  if (threshold === 1) return [data[0]]
  if (threshold === 2) return [data[0], data[len - 1]]

  const sampled: Point[] = []

  // First point is always included
  sampled.push(data[0])

  // We have threshold - 2 buckets for the middle section (first and last are fixed)
  const bucketCount = threshold - 2
  // Each bucket covers this many source points
  const bucketSize = (len - 2) / bucketCount

  let prevSelectedIdx = 0

  for (let i = 0; i < bucketCount; i++) {
    // Current bucket bounds (source indices, excluding first and last point)
    const bucketStart = Math.floor((i + 0) * bucketSize) + 1
    const bucketEnd   = Math.floor((i + 1) * bucketSize) + 1

    // Next bucket: compute its average point (used as the "far anchor")
    const nextBucketStart = bucketEnd
    const nextBucketEnd   = Math.min(Math.floor((i + 2) * bucketSize) + 1, len - 1)

    let avgX = 0
    let avgY = 0
    const nextBucketLen = nextBucketEnd - nextBucketStart
    if (nextBucketLen > 0) {
      for (let j = nextBucketStart; j < nextBucketEnd; j++) {
        avgX += data[j].x
        avgY += data[j].y
      }
      avgX /= nextBucketLen
      avgY /= nextBucketLen
    } else {
      // Degenerate bucket — use the last point as anchor
      avgX = data[len - 1].x
      avgY = data[len - 1].y
    }

    // Previously selected point
    const prevPoint = data[prevSelectedIdx]

    // Find the point in the current bucket that maximises triangle area
    let maxArea = -1
    let selectedIdx = bucketStart

    for (let j = bucketStart; j < bucketEnd; j++) {
      // Triangle area × 2 (we only need relative magnitude so skip the /2)
      // |ax(by - cy) + bx(cy - ay) + cx(ay - by)|
      // a = prevPoint, b = data[j], c = avg of next bucket
      const area = Math.abs(
        (prevPoint.x - avgX) * (data[j].y - prevPoint.y) -
        (prevPoint.x - data[j].x) * (avgY - prevPoint.y)
      )
      if (area > maxArea) {
        maxArea = area
        selectedIdx = j
      }
    }

    sampled.push(data[selectedIdx])
    prevSelectedIdx = selectedIdx
  }

  // Last point is always included
  sampled.push(data[len - 1])

  return sampled
}
