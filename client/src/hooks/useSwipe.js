import { useRef, useCallback } from 'react';

const SWIPE_THRESHOLD = 50;   // min px to count as swipe
const SWIPE_MAX_Y = 80;       // max vertical drift allowed
const SWIPE_TIMEOUT = 300;    // max ms for the gesture

export function useSwipe({ onSwipeLeft, onSwipeRight }) {
  const touchRef = useRef(null);

  const onTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    touchRef.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
  }, []);

  const onTouchEnd = useCallback((e) => {
    if (!touchRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchRef.current.x;
    const dy = Math.abs(touch.clientY - touchRef.current.y);
    const dt = Date.now() - touchRef.current.t;
    touchRef.current = null;

    if (dt > SWIPE_TIMEOUT || dy > SWIPE_MAX_Y) return;
    if (dx > SWIPE_THRESHOLD && onSwipeRight) onSwipeRight();
    if (dx < -SWIPE_THRESHOLD && onSwipeLeft) onSwipeLeft();
  }, [onSwipeLeft, onSwipeRight]);

  return { onTouchStart, onTouchEnd };
}
