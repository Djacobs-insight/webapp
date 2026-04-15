import React from "react";
import clsx from "clsx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button: React.FC<ButtonProps> = ({ variant = "primary", className, ...props }) => {
  return (
    <button
      className={clsx(
        "rounded-full font-bold transition focus:outline-none focus:ring-2 focus:ring-teal",
        {
          // Primary: coral, 56px
          "bg-coral text-warm-white h-14 px-8 text-lg shadow-md hover:bg-coral/90": variant === "primary",
          // Secondary: outline teal, 48px
          "border-2 border-teal text-teal h-12 px-6 bg-transparent hover:bg-teal/10": variant === "secondary",
          // Ghost: teal text, 44px
          "text-teal h-11 px-4 bg-transparent hover:bg-teal/5": variant === "ghost",
          // Destructive: outline red, confirm/undo
          "border-2 border-red-600 text-red-600 h-12 px-6 bg-transparent hover:bg-red-50": variant === "destructive",
          // Icon-only: 48px circle
          "w-12 h-12 flex items-center justify-center p-0 bg-teal text-warm-white rounded-full": variant === "icon",
        },
        className
      )}
      {...props}
    />
  );
};
