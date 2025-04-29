export function timeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  const intervals: [number, string][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.35, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];

  let count = seconds;
  let unit = "second";

  for (const [interval, name] of intervals) {
    if (count < interval) break;
    count /= interval;
    unit = name;
  }

  count = Math.floor(count);
  return `${count} ${unit}${count !== 1 ? "s" : ""} ago`;
}
