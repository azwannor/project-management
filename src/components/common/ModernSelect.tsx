"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

interface ModernSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

export default function ModernSelect({ value, onChange, options, placeholder, className = "" }: ModernSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button 
        type="button"
        className={`flex items-center justify-between w-full bg-gray-50 border rounded-xl px-3 py-2 text-sm text-gray-700 cursor-pointer transition-all duration-200 focus:outline-none ${
          isOpen 
            ? 'border-blue-400 ring-4 ring-blue-500/10 bg-white shadow-sm' 
            : 'border-gray-200 hover:border-gray-300 hover:bg-white'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate pr-2 font-medium">{selectedOption ? selectedOption.label : (placeholder || "Select...")}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-[100] mt-1.5 w-full min-w-[160px] bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 origin-top">
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
            {options.map((opt) => (
              <div
                key={opt.value}
                className={`flex items-center justify-between px-3 py-2.5 text-sm rounded-lg cursor-pointer transition-all duration-150 ${
                  value === opt.value 
                    ? "bg-blue-50 text-blue-700 font-semibold" 
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium"
                }`}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                <span className="truncate">{opt.label}</span>
                {value === opt.value && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-2" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
