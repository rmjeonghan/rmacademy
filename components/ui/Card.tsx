// /components/ui/Card.tsx
import React from 'react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  titleClassName?: string;
  bodyClassName?: string;
}

export default function Card({ title, children, className, titleClassName, bodyClassName }: CardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm ${className}`}>
      {title && (
        <div className={`p-4 sm:p-5 border-b border-slate-200 ${titleClassName}`}>
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        </div>
      )}
      <div className={`p-4 sm:p-5 ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
}

