export const TOUR_GESTURES = ['point', 'sweep', 'open'] as const

export type TourGesture = (typeof TOUR_GESTURES)[number]

export type TourSpot = {
  x: number
  y: number
}

export type TourMove = {
  from: TourSpot
  to: TourSpot
  gesture: TourGesture
}
