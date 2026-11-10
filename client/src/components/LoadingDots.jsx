import { css } from '@linaria/core';

const containerStyle = css`
    display: flex;
    gap: 2px;
    pointer-events: none;
`;

const dotStyle = css`
    animation-delay: var(--delay, 0s);
`;

const LoadingDots = ({ className, style, dotStyle: customDotStyle }) => {
    return (
        <div className={`${containerStyle} ${className || ''}`} style={style}>
            <span className={`loading-dot ${dotStyle}`} style={{ '--delay': '0s', ...customDotStyle }}>.</span>
            <span className={`loading-dot ${dotStyle}`} style={{ '--delay': '0.2s', ...customDotStyle }}>.</span>
            <span className={`loading-dot ${dotStyle}`} style={{ '--delay': '0.4s', ...customDotStyle }}>.</span>
        </div>
    );
};

export default LoadingDots;
