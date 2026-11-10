import { useEffect, useRef } from 'react';

export const useDraggable = ({
    ref,
    onStart,
    onMove,
    onEnd
}) => {
    // Keep callbacks fresh without triggering re-effects
    const onStartRef = useRef(onStart);
    const onMoveRef = useRef(onMove);
    const onEndRef = useRef(onEnd);

    useEffect(() => { onStartRef.current = onStart; }, [onStart]);
    useEffect(() => { onMoveRef.current = onMove; }, [onMove]);
    useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const handleWindowMove = (e) => {
            if (e.type === 'touchmove') e.preventDefault(); // Always prevent scroll during drag
            if (onMoveRef.current) onMoveRef.current(e);
        };

        const handleWindowEnd = (e) => {
            if (onEndRef.current) onEndRef.current(e);
            removeListeners();
        };

        const removeListeners = () => {
            window.removeEventListener('mousemove', handleWindowMove);
            window.removeEventListener('mouseup', handleWindowEnd);
            window.removeEventListener('touchmove', handleWindowMove);
            window.removeEventListener('touchend', handleWindowEnd);
            window.removeEventListener('touchcancel', handleWindowEnd);
        };

        const handleStart = (e) => {
            // Note: Preventing default on touchstart is handled by onStart logic usually,
            // but for safety we want to ensure we don't scroll.
            // However, we rely on onStart to decide.

            if (onStartRef.current) onStartRef.current(e);

            // Attach window listeners synchronously to catch the very next event
            window.addEventListener('mousemove', handleWindowMove);
            window.addEventListener('mouseup', handleWindowEnd);
            // Passive false is crucial for touchmove to prevent scroll
            window.addEventListener('touchmove', handleWindowMove, { passive: false });
            window.addEventListener('touchend', handleWindowEnd);
            window.addEventListener('touchcancel', handleWindowEnd);
        };

        // Manual bind for non-passive touchstart
        element.addEventListener('touchstart', handleStart, { passive: false });
        element.addEventListener('mousedown', handleStart);

        return () => {
            element.removeEventListener('touchstart', handleStart);
            element.removeEventListener('mousedown', handleStart);
            // Ensure we clean up any active drag if the component unmounts
            removeListeners();
        };
    }, [ref]); // Dependencies reduced to just ref. Callbacks are handled via refs.
};
