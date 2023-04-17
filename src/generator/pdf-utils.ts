const POINTS_PER_INCH = 72 // 1 inch = 72 pts
const MM_PER_INCH = 25.4 // 1 inch = 25.4 mm

export function mmToPoints(mm: number) {
  return (mm * POINTS_PER_INCH) / MM_PER_INCH
}

export function mmFromPoints(pts: number) {
  return (pts * MM_PER_INCH) / POINTS_PER_INCH
}
