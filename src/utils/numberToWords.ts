export function numberToWords(num: number): string {
  if (num === 0) return "Zero";
  
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  
  const convertLessThanThousand = (n: number): string => {
    if (n < 20) return a[n];
    const digit = n % 10;
    if (n < 100) return b[Math.floor(n / 10)] + (digit ? "-" + a[digit] : "");
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    return a[hundred] + " Hundred" + (rest ? " " + convertLessThanThousand(rest) : "");
  };

  const chunks = [
    { value: 10000000, label: "Crore" },
    { value: 100000, label: "Lakh" },
    { value: 1000, label: "Thousand" },
    { value: 1, label: "" }
  ];

  let temp = Math.floor(num);
  let result = "";

  for (const chunk of chunks) {
    if (temp >= chunk.value) {
      const count = Math.floor(temp / chunk.value);
      temp %= chunk.value;
      result += (result ? " " : "") + convertLessThanThousand(count) + (chunk.label ? " " + chunk.label : "");
    }
  }

  const decimal = Math.round((num - Math.floor(num)) * 100);
  if (decimal > 0) {
    result += " and " + convertLessThanThousand(decimal) + " Paise";
  }

  return result.trim() + " Only";
}
