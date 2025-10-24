import { useForm, useStore } from "@tanstack/react-form";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { add, format, isAfter, isBefore, max, min, startOfDay } from "date-fns";
import { secondsInMinute } from "date-fns/constants";
import { toast } from "sonner";
import z from "zod";
import { CompactAppointmentCard } from "@/components/appointment";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Queries, QueryKeys } from "@/lib/queries";
import { RPC, rpcErrorMessage } from "@/lib/rpc";
import { combineDateTime } from "@/lib/utils";

export const Route = createFileRoute("/schedule")({
	component: RouteComponent,
});

const formSchema = z
	.object({
		title: z
			.string()
			.nonempty("Please provide a message to go along with your booking"),
		date: z.date(),
		time: z
			.string()
			.regex(/\d{2}:\d{2}/, "That doesn't look like a valid time"),
	})
	.refine(
		(form) => isAfter(combineDateTime(form.date, form.time), new Date()),
		{
			error: "You can't book an appointment in the past",
			path: ["time"],
		},
	);

type FormData = {
	title: string;
	date: Date;
	time: string;
};
const defaultValues = {
	title: "",
	date: startOfDay(new Date()),
	time: format(new Date(), "HH:mm"),
};

const DURATION = secondsInMinute * 30;

function RouteComponent() {
	const navigate = Route.useNavigate();
	const scheduleMut = useMutation({
		mutationFn: async (data: FormData, { client }) => {
			const combinedDate = combineDateTime(data.date, data.time);
			const result = await RPC.scheduleAppointment({
				title: data.title,
				scheduledFor: combinedDate,
				durationSeconds: DURATION,
			});
			if (!result.ok) {
				if (result.error.type === "already_exists") {
					toast.error(
						"Your requested time slot would overlap with another, please try again",
					);
					return result;
				}

				toast.error(`Something went wrong: ${rpcErrorMessage(result.error)}`);
				return result;
			}

			client.invalidateQueries({
				queryKey: [QueryKeys.appointment],
			});
			client.invalidateQueries({
				queryKey: [QueryKeys.appointments],
			});
			toast.success("Appointment booked");
			return result;
		},
	});
	const form = useForm({
		defaultValues,
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			const result = await scheduleMut.mutateAsync(value);
			if (result.ok) {
				form.reset();
				navigate({ to: "/appointments" });
			}
		},
	});
	const date = useStore(form.store, (store) => store.values.date);
	const time = useStore(form.store, (store) => store.values.time);
	const scheduledFor = combineDateTime(date, time);
	const endsAt = add(scheduledFor, { seconds: DURATION });

	const nearbyAppointmentsQuery = useInfiniteQuery({
		...Queries.listAppointments({
			limit: 10,
			after: startOfDay(scheduledFor),
		}),
	});
	const appointments = nearbyAppointmentsQuery.data?.pages.flatMap(
		(page) => page.items,
	);

	const potentialClash = appointments?.find((appointment) => {
		const appointmentEndsAt = add(
			appointment.scheduledFor,
			appointment.duration,
		);
		return isBefore(
			max([scheduledFor, appointment.scheduledFor]),
			min([endsAt, appointmentEndsAt]),
		);
	});

	return (
		<div className="w-full p-4 flex justify-center items-center">
			<Card className="w-full sm:max-w-lg">
				<CardHeader>
					<CardTitle>Schedule appointment</CardTitle>
					<CardDescription>
						Book an appointment with the magician.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						id="schedule-form"
						onSubmit={(e) => {
							e.preventDefault();
							form.handleSubmit();
						}}
					>
						<FieldGroup>
							<form.Field
								name="date"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>Day</FieldLabel>
											<Calendar
												mode="single"
												required
												selected={field.state.value}
												disabled={[{ before: new Date() }]}
												onSelect={(date) => {
													field.handleChange(date);
												}}
											/>
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
										</Field>
									);
								}}
							/>
							{potentialClash && (
								<div className="flex flex-col gap-2">
									<FieldDescription>
										This existing booking may clash with yours:
									</FieldDescription>
									<CompactAppointmentCard appointment={potentialClash} />
								</div>
							)}
							<form.Field
								name="time"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return (
										<Field data-invalid={isInvalid}>
											<FieldContent>
												<FieldLabel htmlFor={field.name}>Time</FieldLabel>
											</FieldContent>
											<Input
												type="time"
												step={60}
												id={field.name}
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												aria-invalid={isInvalid}
												autoComplete="off"
											/>
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
										</Field>
									);
								}}
							/>
							<form.Field
								name="title"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>Title</FieldLabel>
											<Input
												id={field.name}
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												aria-invalid={isInvalid}
												placeholder="Sync with Josephine"
												autoComplete="off"
											/>
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
										</Field>
									);
								}}
							/>
						</FieldGroup>
					</form>
				</CardContent>
				<CardFooter>
					<Field orientation="horizontal">
						<Button
							type="button"
							variant="outline"
							onClick={() => form.reset()}
						>
							Reset
						</Button>
						<Button type="submit" form="schedule-form">
							Book appointment
						</Button>
					</Field>
				</CardFooter>
			</Card>
		</div>
	);
}
