/** EWMA volatility of log returns, reported in basis points per observation. */
export class EwmaVol {
  private last?: number;
  private variance = 0;
  private n = 0;
  constructor(private readonly lambda = 0.94) {}

  update(price: number): number {
    // Ignore unusable observations entirely — above all, never store one as
    // `last`: a single NaN would poison every subsequent return.
    if (!Number.isFinite(price) || price <= 0) return this.bps();
    if (this.last !== undefined) {
      const r = Math.log(price / this.last);
      this.variance = this.n === 0 ? r * r : this.lambda * this.variance + (1 - this.lambda) * r * r;
      this.n++;
    }
    this.last = price;
    return this.bps();
  }

  bps(): number {
    return Math.sqrt(this.variance) * 1e4;
  }
}
