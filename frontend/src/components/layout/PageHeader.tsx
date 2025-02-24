"use client";

import { Moon, Sun, Menu } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MobileMenu } from "@/components/layout/MobileMenu";

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
}

export function PageHeader({ title, showBack = true }: PageHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  return (
    <div className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="flex flex-1 items-center justify-between">
          <div className="flex items-center gap-2">
            {showBack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="mr-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <h1 className="text-lg font-semibold">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
            >
              {/* {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )} */}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMobileMenu(true)}
              className="lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <MobileMenu 
        isOpen={showMobileMenu} 
        onClose={() => setShowMobileMenu(false)} 
      />
    </div>
  );
} 