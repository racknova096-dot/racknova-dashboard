import React, { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DateInputMXProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

const isoToDisplay = (value?: string | null) => {
  if (!value) return "";

  const clean = value.slice(0, 10);
  const parts = clean.split("-");

  if (parts.length !== 3) return "";

  const [year, month, day] = parts;

  if (!year || !month || !day) return "";

  return `${day}/${month}/${year}`;
};

const displayToIso = (value: string) => {
  const clean = value.replace(/[^\d]/g, "").slice(0, 8);

  if (clean.length !== 8) return "";

  const day = clean.slice(0, 2);
  const month = clean.slice(2, 4);
  const year = clean.slice(4, 8);

  const dayNum = Number(day);
  const monthNum = Number(month);
  const yearNum = Number(year);

  if (yearNum < 1900 || yearNum > 2100) return "";
  if (monthNum < 1 || monthNum > 12) return "";
  if (dayNum < 1 || dayNum > 31) return "";

  const date = new Date(`${year}-${month}-${day}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "";

  const isSameDate =
    date.getFullYear() === yearNum &&
    date.getMonth() + 1 === monthNum &&
    date.getDate() === dayNum;

  if (!isSameDate) return "";

  return `${year}-${month}-${day}`;
};

const autoFormatDisplay = (value: string) => {
  const clean = value.replace(/[^\d]/g, "").slice(0, 8);

  if (clean.length <= 2) return clean;
  if (clean.length <= 4) return `${clean.slice(0, 2)}/${clean.slice(2)}`;

  return `${clean.slice(0, 2)}/${clean.slice(2, 4)}/${clean.slice(4)}`;
};

export function DateInputMX({
  value,
  onChange,
  disabled,
  placeholder = "dd/mm/aaaa",
  className,
}: DateInputMXProps) {
  const [displayValue, setDisplayValue] = useState("");

  useEffect(() => {
    setDisplayValue(isoToDisplay(value));
  }, [value]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = autoFormatDisplay(event.target.value);

    setDisplayValue(formatted);

    const isoValue = displayToIso(formatted);

    if (isoValue) {
      onChange(isoValue);
    }

    if (!formatted) {
      onChange("");
    }
  };

  const handleBlur = () => {
    if (!displayValue.trim()) {
      onChange("");
      return;
    }

    const isoValue = displayToIso(displayValue);

    if (!isoValue) {
      setDisplayValue("");
      onChange("");
      return;
    }

    setDisplayValue(isoToDisplay(isoValue));
    onChange(isoValue);
  };

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      placeholder={placeholder}
      maxLength={10}
      className={cn("font-mono", className)}
    />
  );
}
