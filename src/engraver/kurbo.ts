import { Skyline } from './skyline';

export interface Point {
  x: number;
  y: number;
}

export class Kurbo {
  /**
   * Generates control points for a cubic Bezier curve that avoids obstacles in the skyline.
   * @param p0 Start point
   * @param p3 End point
   * @param skyline The skyline to check against
   * @param isTop Whether the curve is above (true) or below (false) the skyline
   * @param measureX The absolute X offset of the measure
   * @returns [p0, p1, p2, p3]
   */
  public static routeSlur(p0: Point, p3: Point, skyline: Skyline, isTop: boolean, measureX: number): [Point, Point, Point, Point] {
    const dx = p3.x - p0.x;
    const dir = isTop ? -1 : 1;
    
    // Initial control points
    let p1: Point = { x: p0.x + dx / 3, y: p0.y + dir * 15 };
    let p2: Point = { x: p3.x - dx / 3, y: p3.y + dir * 15 };

    const steps = 20;
    let maxViolation = 0;
    let maxViolationT = 0;
    let iterations = 0;

    do {
      maxViolation = 0;
      maxViolationT = 0;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const pt = this.evaluateCubic(p0, p1, p2, p3, t);
        
        // Check skyline
        // Skyline array index is Math.floor((measureX + pt.x) / 10)
        // We can just use the drop method to see where the skyline is
        // But drop modifies the skyline. We need a peek method, or we can just access the array.
        // Let's add a peek method to Skyline, or just assume we have access.
        const skylineY = skyline.peek((measureX + pt.x) / 10);
        
        if (isTop) {
          // For top skyline, smaller y is higher.
          // We want the curve to be ABOVE the skyline (so pt.y < skylineY).
          // If pt.y > skylineY - 5, it means the curve is too low (too close to or below the skyline).
          // Wait, skyline is initialized with 0.
          if (skylineY !== 0 && pt.y > skylineY - 5) {
            const violation = pt.y - (skylineY - 5);
            if (violation > maxViolation) {
              maxViolation = violation;
              maxViolationT = t;
            }
          }
        } else {
          // For bottom skyline, larger y is lower.
          // We want the curve to be BELOW the skyline (so pt.y > skylineY).
          if (skylineY !== 0 && pt.y < skylineY + 5) {
            const violation = (skylineY + 5) - pt.y;
            if (violation > maxViolation) {
              maxViolation = violation;
              maxViolationT = t;
            }
          }
        }
      }

      if (maxViolation > 0) {
        if (maxViolationT < 0.5) {
          p1.y += dir * (maxViolation * 2.0 + 2);
          p2.y += dir * (maxViolation * 1.0 + 2);
        } else if (maxViolationT > 0.5) {
          p1.y += dir * (maxViolation * 1.0 + 2);
          p2.y += dir * (maxViolation * 2.0 + 2);
        } else {
          p1.y += dir * (maxViolation * 1.5 + 2);
          p2.y += dir * (maxViolation * 1.5 + 2);
        }
      }
      
      iterations++;
    } while (maxViolation > 0 && iterations < 10);

    return [p0, p1, p2, p3];
  }

  private static evaluateCubic(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    return {
      x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
      y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y
    };
  }
}
