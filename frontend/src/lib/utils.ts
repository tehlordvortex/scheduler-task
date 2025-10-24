import { type ClassValue, clsx } from "clsx";
import { format, parse, startOfDay } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function combineDateTime(date: Date, time: string) {
	const dateOnly = startOfDay(date);
	const dateString = format(dateOnly, "yyyy-MM-dd");
	const combined = parse(
		`${dateString} ${time}`,
		`yyyy-MM-dd HH:mm`,
		new Date(),
	);
	return combined;
}
