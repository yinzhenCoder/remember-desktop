(function (root) {
  function plan({ screenWidth, widths, speed, rounds, spread = 70 }) {
    const durations = widths.map(
      (width) => ((screenWidth + width + 64) / speed) * 1000,
    );
    // Alternate lanes in the entry order instead of marching diagonally as a column.
    const order = Array.from({ length: widths.length }, (_, i) => i).sort(
      (a, b) => (a % 2) - (b % 2) || a - b,
    );
    const span =
      (Math.min(((screenWidth * 0.65) / speed) * 1000, 5000) * spread) / 100;
    const delays = widths.map((_, index) =>
      widths.length === 1
        ? 0
        : (order.indexOf(index) / (widths.length - 1)) * span,
    );
    const roundLength =
      Math.max(...durations.map((duration, i) => duration + delays[i])) + 250;
    const result = [];
    for (let round = 0; round < rounds; round++)
      widths.forEach((_, index) =>
        result.push({
          index,
          round,
          duration: durations[index],
          delay: round * roundLength + delays[index],
        }),
      );
    return result;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = plan;
  else root.reminderMotion = plan;
})(globalThis);
