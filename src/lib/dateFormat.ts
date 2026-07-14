export type DatePeriod = "7d" | "1m" | "1y" | "all";

export const formatDateDDMMYYYY = (value?: string | Date | null) => {
  if (!value) return "Sin fecha";

  const date =
    value instanceof Date
      ? value
      : new Date(
          typeof value === "string" && value.length <= 10
            ? `${value.slice(0, 10)}T00:00:00`
            : value
        );

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
};

export const formatDateTimeDDMMYYYY = (value?: string | Date | null) => {
  if (!value) return "Sin fecha";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

export const getLocalDateKey = (value?: string | Date | null) => {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const cleanDate = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const isDateInPeriod = (
  value: string | Date,
  period: DatePeriod
) => {
  if (period === "all") return true;

  const date = cleanDate(value instanceof Date ? value : new Date(value));

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const today = cleanDate(new Date());

  if (period === "7d") {
    const from = new Date(today);
    from.setDate(today.getDate() - 7);
    return date >= from && date <= today;
  }

  if (period === "1m") {
    const from = new Date(today);
    from.setMonth(today.getMonth() - 1);
    return date >= from && date <= today;
  }

  if (period === "1y") {
    const from = new Date(today);
    from.setFullYear(today.getFullYear() - 1);
    return date >= from && date <= today;
  }

  return true;
};

export const getPeriodLabel = (period: DatePeriod) => {
  if (period === "7d") return "Últimos 7 días";
  if (period === "1m") return "Último mes";
  if (period === "1y") return "Último año";
  return "Todo el historial";
};
