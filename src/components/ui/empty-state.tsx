import React from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, icon, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center text-charcoal">
    {icon && <div className="mb-4 text-5xl">{icon}</div>}
    <h2 className="text-2xl font-bold mb-2">{title}</h2>
    {description && <p className="mb-4 text-lg text-gray-500">{description}</p>}
    {action}
  </div>
);
