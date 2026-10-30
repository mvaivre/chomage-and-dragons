/** Deadline pacing avoids refresh-rate-dependent caps (e.g. 48 FPS on 144 Hz).
 * Idle/hidden time never produces a catch-up burst. Simulation uses actual dt. */
export class FramePacer {
  private next = 0;
  private interval = 0;
  ready(now: number, interval: number) {
    if (interval !== this.interval) { this.interval = interval; this.next = now; }
    if (now + .5 < this.next) return false;
    this.next += interval;
    if (this.next <= now) this.next = now + interval;
    return true;
  }
  reset() { this.next = 0; }
}
