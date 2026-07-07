// ──── Game Mechanics ────

/** Point-buy budget for ability score purchasing. */
export const POINT_BUY_BUDGET = 27;

/** Minimum ability score for point-buy. */
export const MIN_ABILITY_SCORE = 8;

/** Maximum ability score for point-buy (before racial bonuses). */
export const MAX_ABILITY_SCORE = 15;

/** Default starting HP used when no class is selected. */
export const DEFAULT_STARTING_HP = 8;

/** Number of death save slots. */
export const MAX_DEATH_SAVES = 3;

// ──── App Behaviour ────

/** Duration (ms) that the splash screen is shown. */
export const SPLASH_DURATION_MS = 1650;

/** Debounce delay (ms) for colour pickers and similar inputs. */
export const INPUT_DEBOUNCE_MS = 300;

// ──── Auth ────

/** Minimum password length for registration. */
export const MIN_PASSWORD_LENGTH = 8;

/** Salt rounds for bcrypt password hashing. */
export const BCRYPT_ROUNDS = 10;
