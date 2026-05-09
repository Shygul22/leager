import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getBillTotal = (items: any[]) => 
  (items || []).reduce((s, i) => s + (i.quantity * i.rate * (1 + (i.gst || 0) / 100)), 0);

export const getInvoiceTotal = (items: any[], discountPercentage: number = 0) => {
  const subtotal = (items || []).reduce((s, i) => s + i.quantity * i.rate, 0);
  const discount = subtotal * (discountPercentage / 100);
  const gstTotal = (items || []).reduce((s, i) => s + (i.quantity * i.rate * (i.gst / 100)), 0) * (1 - discountPercentage / 100);
  return (subtotal - discount) + gstTotal;
};
