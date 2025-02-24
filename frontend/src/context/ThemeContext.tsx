"use client";

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    // Check system preference
    const systemTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'light';
    const savedTheme = localStorage.getItem('theme') as Theme;
    setTheme(savedTheme || systemTheme);

    // Apply theme to document
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'light' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
} 