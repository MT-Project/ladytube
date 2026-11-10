import React, { useRef, useState, useEffect, useCallback } from 'react';
import { css } from '@linaria/core';

// Linaria styles
const styles = {
    sliderContainer: css`
        width: 100%;
        height: 40px;
        display: flex;
        align-items: center;
        position: relative;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
        touch-action: none;
        outline: none;
    `,
    track: css`
        width: 100%;
        height: 4px;
        background-color: #4b5563;
        border-radius: 2px;
        position: relative;
    `,
    trackFilled: css`
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        border-radius: 2px;
    `,
    thumb: css`
        position: absolute;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 14px;
        height: 14px;
        background-color: white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    `,
};

const Slider = ({
    value,
    min,
    max,
    step = 1,
    onChange,
    onChangeCommitted,
    disabled = false
}) => {
    const trackRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);

    const onChangeRef = useRef(onChange);
    const onChangeCommittedRef = useRef(onChangeCommitted);

    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
    useEffect(() => { onChangeCommittedRef.current = onChangeCommitted; }, [onChangeCommitted]);

    const getPercentage = useCallback((val) => {
        const percentage = ((val - min) / (max - min)) * 100;
        return Math.max(0, Math.min(100, percentage));
    }, [min, max]);

    const getValueFromClientX = useCallback((clientX) => {
        if (!trackRef.current) return min;
        const rect = trackRef.current.getBoundingClientRect();
        const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));

        let rawValue = min + percentage * (max - min);

        if (step) {
            const steps = Math.round((rawValue - min) / step);
            rawValue = min + steps * step;
        }

        return Math.max(min, Math.min(max, rawValue));
    }, [min, max, step]);

    const handleStart = (clientX) => {
        if (disabled) return;
        setIsDragging(true);
        const newValue = getValueFromClientX(clientX);
        if (onChangeRef.current) onChangeRef.current(newValue);
    };

    const handleMove = useCallback((clientX) => {
        if (disabled) return;
        const newValue = getValueFromClientX(clientX);
        if (onChangeRef.current) onChangeRef.current(newValue);
    }, [disabled, getValueFromClientX]);

    const handleEnd = useCallback((clientX) => {
        if (disabled) return;
        setIsDragging(false);

        if (onChangeCommittedRef.current) {
            if (clientX !== null) {
                const newValue = getValueFromClientX(clientX);
                onChangeCommittedRef.current(newValue);
            }
        }
    }, [disabled, getValueFromClientX]);

    useEffect(() => {
        if (!isDragging) return;

        const onMouseMove = (e) => {
            e.preventDefault();
            handleMove(e.clientX);
        };
        const onMouseUp = (e) => {
            handleEnd(e.clientX);
        };
        const onTouchMove = (e) => {
            e.preventDefault();
            if (e.touches && e.touches.length > 0) {
                handleMove(e.touches[0].clientX);
            }
        };
        const onTouchEnd = (e) => {
            if (e.changedTouches && e.changedTouches.length > 0) {
                handleEnd(e.changedTouches[0].clientX);
            } else {
                handleEnd(null);
            }
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);
        };
    }, [isDragging, handleMove, handleEnd]);

    const onMouseDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleStart(e.clientX);
    };

    const onTouchStart = (e) => {
        e.stopPropagation();
        if (e.touches && e.touches.length > 0) {
            handleStart(e.touches[0].clientX);
        }
    };

    const onKeyDown = (e) => {
        if (disabled) return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            const newValue = Math.max(min, value - step);
            if (onChangeRef.current) onChangeRef.current(newValue);
            if (onChangeCommittedRef.current) onChangeCommittedRef.current(newValue);
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            const newValue = Math.min(max, value + step);
            if (onChangeRef.current) onChangeRef.current(newValue);
            if (onChangeCommittedRef.current) onChangeCommittedRef.current(newValue);
        }
    };

    const percentage = getPercentage(value);

    return (
        <div
            ref={trackRef}
            role="slider"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            tabIndex={disabled ? -1 : 0}
            onKeyDown={onKeyDown}
            className={styles.sliderContainer}
            style={{ cursor: disabled ? 'default' : 'pointer' }}
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
        >
            {/* Track Line */}
            <div className={styles.track}>
                {/* Filled Track */}
                <div
                    className={styles.trackFilled}
                    style={{
                        backgroundColor: disabled ? '#6b7280' : '#3b82f6',
                        width: `${percentage}%`,
                    }}
                />

                {/* Thumb */}
                <div
                    className={styles.thumb}
                    style={{
                        left: `${percentage}%`,
                        transition: isDragging ? 'none' : 'transform 0.1s'
                    }}
                ></div>
            </div>
        </div>
    );
};

export default Slider;
