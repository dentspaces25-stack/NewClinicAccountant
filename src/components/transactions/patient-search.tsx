"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search, User, Check } from "lucide-react";

interface Patient {
  id: string;
  name: string;
}

interface PatientSearchProps {
  patients: Patient[];
  value: string;
  selectedPatientId?: string;
  onSelect: (name: string, patientId?: string) => void;
  placeholder?: string;
}

export function PatientSearch({
  patients,
  value,
  selectedPatientId,
  onSelect,
  placeholder,
}: PatientSearchProps) {
  const [localQuery, setLocalQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const isTypingRef = useRef(false);
  const justSelectedRef = useRef(false);

  // Sync from parent only when not typing
  useEffect(() => {
    if (!isTypingRef.current && !justSelectedRef.current) {
      setLocalQuery(value);
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        isTypingRef.current = false;
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = localQuery.trim()
    ? patients.filter((p) => p.name.toLowerCase().includes(localQuery.toLowerCase().trim()))
    : patients;

  const handleChange = useCallback((val: string) => {
    isTypingRef.current = true;
    justSelectedRef.current = false;
    setLocalQuery(val);
    setIsOpen(true);
    setHighlightIndex(-1);
  }, []);

  // Debounced parent update while typing
  useEffect(() => {
    if (!isTypingRef.current) return;
    const t = setTimeout(() => onSelect(localQuery, undefined), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localQuery]);

  const doSelect = useCallback((patient: Patient) => {
    isTypingRef.current = false;
    justSelectedRef.current = true;
    setLocalQuery(patient.name);
    setIsOpen(false);
    setHighlightIndex(-1);
    onSelect(patient.name, patient.id);
    // Reset flag after a tick
    setTimeout(() => { justSelectedRef.current = false; }, 100);
  }, [onSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || filtered.length === 0) {
      if (e.key === "ArrowDown" && patients.length > 0) {
        setIsOpen(true);
        setHighlightIndex(0);
        e.preventDefault();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setHighlightIndex((i) => (i < filtered.length - 1 ? i + 1 : 0)); break;
      case "ArrowUp": e.preventDefault(); setHighlightIndex((i) => (i > 0 ? i - 1 : filtered.length - 1)); break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < filtered.length) doSelect(filtered[highlightIndex]);
        break;
      case "Escape": setIsOpen(false); setHighlightIndex(-1); break;
    }
  }, [isOpen, filtered, highlightIndex, patients.length, doSelect]);

  return (
    <div ref={containerRef} className="relative" style={{ overflow: "visible" }}>
      <div className="relative">
        <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
        <Input
          value={localQuery}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-8 text-sm ps-7 pe-7"
          autoComplete="off"
        />
        {selectedPatientId && (
          <div className="absolute end-2 top-1/2 -translate-y-1/2">
            <Check className="h-3.5 w-3.5 text-teal-500" />
          </div>
        )}
      </div>

      {/* Dropdown - positioned ABOVE to avoid dialog overflow clipping */}
      {isOpen && filtered.length > 0 && (
        <div
          className="absolute bottom-full mb-1 w-full min-w-[220px] max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl"
          style={{ zIndex: 99999 }}
        >
          {filtered.map((patient, idx) => (
            <div
              key={patient.id}
              className={`flex items-center gap-2.5 w-full text-start px-3 py-2.5 text-sm cursor-pointer select-none transition-colors border-b border-gray-50 last:border-0 ${
                idx === highlightIndex
                  ? "bg-teal-50 text-teal-800"
                  : patient.id === selectedPatientId
                  ? "bg-teal-50/50 text-teal-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
              onMouseDown={(e) => {
                // Prevent input blur and any other default behavior
                e.preventDefault();
              }}
              onClick={() => {
                doSelect(patient);
              }}
              onMouseEnter={() => setHighlightIndex(idx)}
            >
              <User className="h-4 w-4 shrink-0 text-gray-400" />
              <span className="truncate">{patient.name}</span>
              {patient.id === selectedPatientId && (
                <Check className="h-3.5 w-3.5 ms-auto text-teal-500 shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
