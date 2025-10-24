import { GrpcWebFetchTransport } from "@protobuf-ts/grpcweb-transport";
import { RpcError as GrpcError } from "@protobuf-ts/runtime-rpc";
import { type Duration, intervalToDuration } from "date-fns";
import invariant from "tiny-invariant";
import { env } from "@/env";
import { Timestamp } from "./google/protobuf/timestamp";
import type * as Proto from "./proto/schedulr";
import {
	AppointmentServiceClient,
	EventServiceClient,
} from "./proto/schedulr.client";
import { Result } from "./result";

const transport = new GrpcWebFetchTransport({
	baseUrl: env.VITE_GRPC_URL,
});
const client = new AppointmentServiceClient(transport);
const eventClient = new EventServiceClient(transport);

export type RPCError =
	| { type: "not_found"; message: string }
	| { type: "already_exists"; message: string }
	| { type: "unknown"; message: string; error: unknown };
export type RPCResult<T> = Result<T, RPCError>;

export type Appointment = {
	id: string;
	title: string;
	scheduledFor: Date;
	duration: Duration;
};

export type SharedRPCParams = {
	abort?: AbortSignal;
};

export const RPC = {
	async scheduleAppointment(
		params: {
			title: string;
			scheduledFor: Date;
			durationSeconds: number;
		} & SharedRPCParams,
	): Promise<RPCResult<Appointment>> {
		const req: Proto.ScheduleAppointmentRequest = {
			title: params.title,
			scheduledFor: Timestamp.fromDate(params.scheduledFor),
			duration: {
				seconds: BigInt(params.durationSeconds),
				nanos: 0,
			},
		};

		const rpcCall = client.schedule(req, {
			abort: params.abort,
		});
		const rpcResult = await tryCall(rpcCall.response);
		if (!rpcResult.ok) {
			return rpcResult;
		}

		return Result.ok(appointmentFromProto(rpcResult.data));
	},

	async getAppointment(
		params: { id: string } & SharedRPCParams,
	): Promise<RPCResult<Appointment | null>> {
		const req: Proto.GetAppointmentRequest = {
			bookingId: params.id,
		};
		const rpcCall = client.get(req, {
			abort: params.abort,
		});
		const rpcResult = await tryCall(rpcCall.response);
		if (!rpcResult.ok) {
			if (rpcResult.error.type === "not_found") {
				return Result.ok(null);
			}

			return rpcResult;
		}

		return Result.ok(appointmentFromProto(rpcResult.data));
	},

	async deleteAppointment(
		params: { id: string } & SharedRPCParams,
	): Promise<RPCResult<null>> {
		const req: Proto.DeleteAppointmentRequest = {
			bookingId: params.id,
		};
		const rpcCall = client.delete(req, {
			abort: params.abort,
		});
		const rpcResult = await tryCall(rpcCall.response);
		if (!rpcResult.ok) {
			return rpcResult;
		}

		return Result.ok(null);
	},

	async listAppointments(
		params: {
			limit: number;
			cursor?: string;
			before?: Date;
			after?: Date;
		} & SharedRPCParams,
	): Promise<RPCResult<{ items: Appointment[]; next_cursor?: string }>> {
		const req: Proto.ListAppointmentsRequest = {
			limit: params.limit,
			cursor: params.cursor,
			before: params.before ? Timestamp.fromDate(params.before) : undefined,
			after: params.after ? Timestamp.fromDate(params.after) : undefined,
		};
		const rpcCall = client.list(req, {
			abort: params.abort,
		});
		const rpcResult = await tryCall(rpcCall.response);
		if (!rpcResult.ok) {
			return rpcResult;
		}
		const items = rpcResult.data.appointments.map(appointmentFromProto);

		return Result.ok({ items, next_cursor: rpcResult.data.nextCursor });
	},

	async subscribeToEvents(
		params: { callback: () => void } & SharedRPCParams,
	): Promise<RPCResult<null>> {
		const rpcCall = eventClient.subscribe(
			{},
			{
				abort: params.abort,
			},
		);

		await Promise.race([
			Result.tryAsync(async () => {
				for await (const _ of rpcCall.responses) {
					params.callback();
				}
			}),
			rpcCall,
		]);

		const rpcStatusResult = await tryCall(rpcCall.status);
		if (!rpcStatusResult.ok) {
			return rpcStatusResult;
		}

		const error = new Error("unexpected stream end");
		return Result.error({
			type: "unknown",
			error: error,
			message: error.message,
		});
	},
};

function grpcErrorToRPCError(err: GrpcError): RPCError {
	if (err.code === "NOT_FOUND") {
		return { type: "not_found", message: err.message };
	}

	if (err.code === "ALREADY_EXISTS") {
		return { type: "already_exists", message: err.message };
	}

	return { type: "unknown", message: err.message, error: err };
}

async function tryCall<T>(promise: Promise<T>): Promise<RPCResult<T>> {
	return Result.mapErr(
		await Result.tryAsync<T, GrpcError>(() => promise),
		grpcErrorToRPCError,
	);
}

function appointmentFromProto(
	protoAppointment: Proto.Appointment,
): Appointment {
	const scheduledFor = protoAppointment.scheduledFor;
	invariant(scheduledFor, "scheduledFor missing in response");
	const duration = protoAppointment.duration;
	invariant(duration, "duration missing in response");

	return {
		id: protoAppointment.bookingId,
		title: protoAppointment.title,
		scheduledFor: Timestamp.toDate(scheduledFor),
		duration: intervalToDuration({
			start: 0,
			end: Number(duration.seconds * 1000n),
		}),
	};
}

export function rpcErrorMessage(err: RPCError): string {
	return err.message;
}
