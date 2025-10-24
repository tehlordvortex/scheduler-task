import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format, formatDistance, isEqual, parse, startOfDay } from "date-fns";
import { AppointmentCard } from "@/components/appointment";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/loading";
import { Queries } from "@/lib/queries";
import type { Appointment } from "@/lib/rpc";

export const Route = createFileRoute("/appointments")({
	component: RouteComponent,
	async loader({ context }) {
		await context.queryClient.ensureInfiniteQueryData(
			Queries.listAppointments({ limit: 10 }),
		);
	},
});

function RouteComponent() {
	const referenceDate = new Date();
	const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
		useSuspenseInfiniteQuery(Queries.listAppointments({ limit: 10 }));

	const allAppointments = data.pages.flatMap((page) => page.items);
	const grouped = groupByCalendarDays(allAppointments);

	return (
		<div className="w-full p-4 flex justify-center items-center">
			<div className="flex flex-col gap-6 sm:gap-8 w-full sm:max-w-md">
				{grouped.map(([date, appointments]) => {
					const isToday = isEqual(startOfDay(referenceDate), startOfDay(date));
					return (
						<div
							className="w-full flex flex-col gap-4"
							key={date.toISOString()}
						>
							<p className="font-bold text-2xl">
								{isToday
									? "today"
									: formatDistance(date, referenceDate, { addSuffix: true })}
							</p>
							{appointments.map((appointment) => (
								<AppointmentCard
									key={appointment.id}
									appointment={appointment}
								/>
							))}
						</div>
					);
				})}
				{grouped.length === 0 && (
					<div className="text-center">
						<p className="text-sm text-gray-500">You're all caught up.</p>
					</div>
				)}
				{hasNextPage && !isFetchingNextPage && (
					<Button onClick={() => fetchNextPage()}>Load more</Button>
				)}
				{isFetchingNextPage && <PageLoader />}
			</div>
		</div>
	);
}

function groupByCalendarDays(appointments: Appointment[]) {
	const referenceDate = new Date();
	const map = new Map<string, Appointment[]>();

	for (const appointment of appointments) {
		const day = startOfDay(appointment.scheduledFor);
		const dateString = format(day, "yyyy-MM-dd");
		let appointments = map.get(dateString);
		if (!appointments) {
			appointments = [];
			map.set(dateString, appointments);
		}

		appointments.push(appointment);
	}

	const entries: [Date, Appointment[]][] = [...map.entries()].map(
		([dateString, appointments]) => [
			parse(dateString, "yyyy-MM-dd", referenceDate),
			appointments,
		],
	);

	return entries;
}
