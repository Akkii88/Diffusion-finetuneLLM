"use client";
import { ReactNode } from "react";
import { useTheme } from "./ThemeProvider";

interface DarkModeWrapperProps {
    children: ReactNode;
    className?: string;
    darkClassName?: string;
    lightClassName?: string;
}

export function DarkModeWrapper({ children, className = "", darkClassName = "", lightClassName = "" }: DarkModeWrapperProps) {
    const { resolvedTheme } = useTheme();
    
    return (
        <div className={`${className} ${resolvedTheme === "dark" ? darkClassName : lightClassName}`}>
            {children}
        </div>
    );
}

// Dark mode specific styles helper
export function useDarkMode() {
    const { resolvedTheme } = useTheme();
    return resolvedTheme === "dark";
}
