/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Mapping tailwind colors to CSS variables
        background: {
          primary: "var(--bg-primary)",
          secondary: "var(--bg-secondary)",
          tertiary: "var(--bg-tertiary)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        border: {
          subtle: "var(--border-subtle)",
          highlight: "var(--border-highlight)",
        },
        accent: {
          DEFAULT: "var(--accent-primary)",
          glow: "var(--accent-glow)",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 20px -5px var(--accent-glow)",
        card: "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.15)",
        "glow-sm": "0 0 12px -4px var(--accent-glow)",
        "glow-md": "0 0 20px -5px var(--accent-glow)",
        "glow-lg": "0 0 32px -8px var(--accent-glow)",
        "glow-xl":
          "0 0 40px -10px var(--accent-glow), inset 0 1px 0 rgba(110, 231, 183, 0.1)",
        "inner-glow": "inset 0 1px 0 rgba(110, 231, 183, 0.1)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-emerald":
          "linear-gradient(135deg, rgba(16, 163, 127, 0.08), rgba(110, 231, 183, 0.04))",
        "gradient-emerald-dark":
          "linear-gradient(135deg, rgba(16, 163, 127, 0.04), rgba(110, 231, 183, 0.02))",
      },
      animation: {
        "slide-in-up": "slideInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards",
        "slide-in-left":
          "slideInLeft 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards",
        "slide-in-right":
          "slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards",
        "fade-in-scale":
          "fadeInScale 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards",
      },
      transitionTimingFunction: {
        "linear-ease": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      borderWidth: {
        ghost: "1px",
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
    require("@tailwindcss/forms"),
    require("daisyui"),
  ],
  daisyui: {
    themes: ["dark"], // Force dark mode for now as per Linear style
    base: false, // Start without daisyUI's base styles to have full control
  },
};
