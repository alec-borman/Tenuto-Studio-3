export class Skyline {
  private array: Float32Array;
  private scale: number;
  private isTop: boolean;

  constructor(width: number, resolution: number = 10, isTop: boolean = true) {
    this.scale = resolution;
    this.array = new Float32Array(Math.ceil(width * resolution));
    this.isTop = isTop;
  }

  /**
   * Drops a bounding box onto the skyline and returns the new Y coordinate.
   * @param x The X coordinate (in staff spaces)
   * @param width The width (in staff spaces)
   * @param height The height of the bounding box (in staff spaces)
   * @param currentY The current Y coordinate of the object (in staff spaces)
   * @returns The resolved Y coordinate
   */
  public drop(x: number, width: number, height: number, currentY: number): number {
    const startIdx = Math.max(0, Math.floor(x * this.scale));
    const endIdx = Math.min(this.array.length - 1, Math.ceil((x + width) * this.scale));
    
    let extremeY = this.isTop ? Infinity : -Infinity;
    
    for (let i = startIdx; i <= endIdx; i++) {
      if (this.isTop) {
        if (this.array[i] < extremeY && this.array[i] !== 0) {
          extremeY = this.array[i];
        }
      } else {
        if (this.array[i] > extremeY) {
          extremeY = this.array[i];
        }
      }
    }
    
    // If the array is empty at this range, use currentY
    if (extremeY === -Infinity || extremeY === Infinity || extremeY === 0) {
      extremeY = currentY;
    }
    
    let resolvedY = currentY;
    if (this.isTop) {
      // Top skyline: we want the minimum Y (highest visually)
      resolvedY = Math.min(currentY, extremeY - height);
    } else {
      // Bottom skyline: we want the maximum Y (lowest visually)
      resolvedY = Math.max(currentY, extremeY + height);
    }
    
    // Update the skyline
    for (let i = startIdx; i <= endIdx; i++) {
      this.array[i] = resolvedY;
    }
    
    return resolvedY;
  }

  /**
   * Updates the skyline with a known bounding box without moving it.
   */
  public insert(x: number, width: number, yExtent: number) {
    const startIdx = Math.max(0, Math.floor(x * this.scale));
    const endIdx = Math.min(this.array.length - 1, Math.ceil((x + width) * this.scale));
    
    for (let i = startIdx; i <= endIdx; i++) {
      if (this.isTop) {
        if (yExtent < this.array[i] || this.array[i] === 0) {
          this.array[i] = yExtent;
        }
      } else {
        if (yExtent > this.array[i]) {
          this.array[i] = yExtent;
        }
      }
    }
  }
}
