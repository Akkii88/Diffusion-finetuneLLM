/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                primary: '#000000',
                'primary-light': '#404040',
                'background-light': '#f6f6f8',
                'background-subtle': '#f8f9fc',
                'text-main': '#1e293b',
                'text-muted': '#64748b',
                'border-subtle': '#e4e4e7',
            },
            fontFamily: {
                display: ['Space Grotesk', 'sans-serif'],
                body: ['Inter', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            borderRadius: {
                DEFAULT: '0.25rem',
                sm: '0.125rem',
                lg: '0.5rem',
                xl: '0.75rem',
                '2xl': '1rem',
                full: '9999px',
            },
            backgroundImage: {
                'micro-grid': "url(\"data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 0V20M0 1H20' fill='none' stroke='%23E5E7EB' stroke-width='0.5'/%3E%3C/svg%3E\")",
                'dot-grid': "radial-gradient(#000000 1px, transparent 1px)",
            },
        },
    },
    plugins: [],
}
