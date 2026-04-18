export interface SequenceMatcherOptions {
  /** Max ms allowed between consecutive inputs before the sequence resets. 0 = no limit. */
  timeout?: number;
  /** Reset progress on any wrong button press. Default: true. */
  resetOnMiss?: boolean;
}

/**
 * Pure stateful sequence matcher — no React, no side effects.
 * Call `onButtonUp(name)` on each button release; it returns `true` when
 * the full sequence has been matched so the caller can fire its callback.
 *
 * Used by both `useGamepadSequence` and `useGamepadCore` (for `onKonamiSuccess`).
 */
export class SequenceMatcher {
  private progress = 0;
  private lastInputTime = 0;
  private sequence: string[];
  private timeout: number;
  private resetOnMiss: boolean;

  constructor(sequence: string[], options: SequenceMatcherOptions = {}) {
    this.sequence = sequence;
    this.timeout = options.timeout ?? 0;
    this.resetOnMiss = options.resetOnMiss ?? true;
  }

  setSequence(sequence: string[]): void {
    this.sequence = sequence;
    this.reset();
  }

  setOptions(options: SequenceMatcherOptions): void {
    if (options.timeout !== undefined) this.timeout = options.timeout;
    if (options.resetOnMiss !== undefined) this.resetOnMiss = options.resetOnMiss;
  }

  /**
   * Call on every button-up event. Returns `true` when the full sequence is matched.
   */
  onButtonUp(buttonName: string): boolean {
    const now = Date.now();

    // Reset if too much time passed since the last input
    if (this.timeout > 0 && this.progress > 0 && now - this.lastInputTime > this.timeout) {
      this.progress = 0;
    }

    const expected = this.sequence[this.progress];

    if (buttonName === expected) {
      this.progress++;
      this.lastInputTime = now;

      if (this.progress >= this.sequence.length) {
        this.progress = 0;
        return true; // sequence complete
      }
    } else if (this.resetOnMiss) {
      // Wrong button — restart only if it matches the first element
      this.progress = buttonName === this.sequence[0] ? 1 : 0;
      if (this.progress > 0) this.lastInputTime = now;
    }

    return false;
  }

  reset(): void {
    this.progress = 0;
    this.lastInputTime = 0;
  }

  getProgress(): number {
    return this.progress;
  }

  getLength(): number {
    return this.sequence.length;
  }
}
