/** Tunable defaults. Callers may override the contradiction ones per call. */
export const SUSTAINED_PERIODS = 3; // consecutive valid periods a rank-drop must hold
export const RANK_MARGIN = 2; // observed rank must be worse than asserted + margin
export const DECAY_HALFLIFE_DAYS = { stable: 365, slow: 30, volatile: 7 } as const;
export const MIN_CONFIDENCE = 0.05; // decay floor
