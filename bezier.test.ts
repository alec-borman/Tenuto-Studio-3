import { describe, it, expect } from 'vitest';
import { Kurbo, Point } from './src/engraver/kurbo';
import { Skyline } from './src/engraver/skyline';

describe('Kurbo Bezier Router', () => {
  it('detects collision when a control point is artificially forced below a mocked Skyline array index', () => {
    const skyline = new Skyline(100, 10, true); // Top skyline
    
    // The skyline scale is 10.
    // The curve goes from x=10 to x=90.
    // Let's insert an obstacle that covers the entire range of the curve.
    // We want the skyline to be at y=20.
    // In Skyline, insert(x, width, yExtent)
    skyline.insert(0, 100, 20);
    
    const p0: Point = { x: 10, y: 50 };
    const p3: Point = { x: 90, y: 50 };
    
    // measureX = 0
    // The curve will start at y=50, go up (since isTop=true, dir=-1)
    // Initial control points will be around y=35.
    // The obstacle is at y=20.
    // So the curve will naturally be below the obstacle (y > 20).
    // The router should push the control points up (smaller y) to clear the obstacle.
    
    const [cp0, cp1, cp2, cp3] = Kurbo.routeSlur(p0, p3, skyline, true, 0);
    
    // The control points should have been pushed up significantly
    // to clear the obstacle at y=20.
    // The apex of the curve should be less than 20.
    // Let's check the y values of the control points.
    expect(cp1.y).toBeLessThan(20);
    expect(cp2.y).toBeLessThan(20);
  });
});
