export const theme = {
    colors: {
        bg: {
            primary: 'var(--bg-primary)',
            secondary: 'var(--bg-secondary)',
            tertiary: 'var(--bg-tertiary)',
            modal: 'var(--bg-modal)',
            overlay: 'rgba(0, 0, 0, 0.5)', // Overlay stays transparent black
            hover: 'var(--bg-hover)',
            selected: 'var(--bg-selected)',
            input: 'var(--bg-modal)',       // Input usually matches modal/card bg
        },
        text: {
            primary: 'var(--text-primary)',
            secondary: 'var(--text-secondary)',
            placeholder: 'var(--text-secondary)',
            inverse: 'var(--text-inverse)',
            link: 'var(--accent)',
        },
        border: {
            primary: 'var(--border-primary)',
            secondary: 'var(--border-secondary)',
            focus: 'var(--border-focus)',
        },
        accent: {
            primary: 'var(--accent)',
            hover: 'var(--accent-hover)',
            light: 'var(--accent-light)',
        },
        status: {
            success: 'var(--status-success)',
            error: 'var(--status-error)',
            warning: 'var(--status-warning)',
            info: 'var(--status-info)',
        },
        button: {
            primary: {
                bg: 'var(--accent)',
                text: '#ffffff', // Primary buttons usually keep white text even in dark mode
                hover: 'var(--accent-hover)'
            },
            secondary: {
                bg: 'var(--bg-secondary)',
                text: 'var(--text-primary)',
                hover: 'var(--bg-hover)'
            },
            danger: {
                bg: 'var(--status-error)',
                text: '#ffffff',
                hover: '#b81200' // Keep explicit hover for danger for now, or use var if needed
            }
        }
    }
};
