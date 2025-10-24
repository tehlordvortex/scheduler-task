import { useMutation } from "@tanstack/react-query";
import { format, formatDuration } from "date-fns";
import { Calendar, Clock, Loader2, Trash } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { QueryKeys } from "@/lib/queries";
import { type Appointment, RPC, rpcErrorMessage } from "@/lib/rpc";

function AppointmentCard({ appointment }: { appointment: Appointment }) {
	const deleteMut = useMutation({
		mutationFn: async (_, { client }) => {
			const result = await RPC.deleteAppointment({
				id: appointment.id,
			});
			if (!result.ok) {
				toast.error(`Something went wrong: ${rpcErrorMessage(result.error)}`);
				return result;
			}

			client.invalidateQueries({
				queryKey: [QueryKeys.appointment],
			});
			client.invalidateQueries({
				queryKey: [QueryKeys.appointments],
			});
			toast.success("Appointment deleted");
			return result;
		},
	});

	return (
		<Card className="w-full">
			<CardHeader>
				<CardDescription className="inline-flex gap-2.5 items-center">
					<span className="inline-flex gap-1 items-center">
						<Calendar size="1em" color="currentColor" />
						{format(appointment.scheduledFor, "yyyy-MM-dd hh:mm a")}
					</span>
					<span className="inline-flex gap-1 items-center">
						<Clock size="1em" color="currentColor" />
						{formatDuration(appointment.duration)}
					</span>
				</CardDescription>
				<CardAction>
					<Button
						variant="outline"
						size="icon"
						disabled={deleteMut.isPending}
						onClick={() => deleteMut.mutate()}
					>
						{deleteMut.isPending ? (
							<Loader2 className="animate-spin" />
						) : (
							<Trash size="1em" color="currentColor" />
						)}
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<CardTitle>{appointment.title}</CardTitle>
			</CardContent>
		</Card>
	);
}

function CompactAppointmentCard({ appointment }: { appointment: Appointment }) {
	return (
		<Card className="w-full py-4">
			<CardContent className="px-4 flex flex-col gap-2">
				<CardDescription className="inline-flex gap-2.5 items-center">
					<span className="inline-flex gap-1 items-center">
						<Calendar size="1em" color="currentColor" />
						{format(appointment.scheduledFor, "yyyy-MM-dd hh:mm a")}
					</span>
					<span className="inline-flex gap-1 items-center">
						<Clock size="1em" color="currentColor" />
						{formatDuration(appointment.duration)}
					</span>
				</CardDescription>
				<CardTitle>{appointment.title}</CardTitle>
			</CardContent>
		</Card>
	);
}

export { AppointmentCard, CompactAppointmentCard };
