import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        success: {
  DEFAULT: "hsl(var(--success))",
  foreground: "hsl(var(--success-foreground))",
},
warning: {
  DEFAULT: "hsl(var(--warning))",
  foreground: "hsl(var(--warning-foreground))",
},
info: {
  DEFAULT: "hsl(var(--info))",
  foreground: "hsl(var(--info-foreground))",
},
profit: {
  DEFAULT: "hsl(var(--profit))",
  foreground: "hsl(var(--profit-foreground))",
},
cost: {
  DEFAULT: "hsl(var(--cost))",
  foreground: "hsl(var(--cost-foreground))",
},
chart: {
  blue: "hsl(var(--chart-blue))",
  green: "hsl(var(--chart-green))",
  orange: "hsl(var(--chart-orange))",
  red: "hsl(var(--chart-red))",
  purple: "hsl(var(--chart-purple))",
  cyan: "hsl(var(--chart-cyan))",
},
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        slot: {
  free: "hsl(var(--slot-free))",
  "free-foreground": "hsl(var(--slot-free-foreground))",
  placing: "hsl(var(--slot-placing))",
  "placing-foreground": "hsl(var(--slot-placing-foreground))",
  occupied: "hsl(var(--slot-occupied))",
  "occupied-foreground": "hsl(var(--slot-occupied-foreground))",
  removing: "hsl(var(--slot-removing))",
  "removing-foreground": "hsl(var(--slot-removing-foreground))",
  hover: "hsl(var(--slot-hover))",
},
      },
      backgroundImage: {
        "gradient-primary": "var(--gradient-primary)",
"gradient-dashboard": "var(--gradient-dashboard)",
"gradient-card": "var(--gradient-card)",
"gradient-slot-free": "var(--gradient-slot-free)",
"gradient-slot-placing": "var(--gradient-slot-placing)",
"gradient-slot-occupied": "var(--gradient-slot-occupied)",
"gradient-slot-removing": "var(--gradient-slot-removing)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
