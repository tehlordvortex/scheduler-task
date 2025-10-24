import { infiniteQueryOptions } from "@tanstack/react-query";
import { Result } from "./result";
import { RPC, type SharedRPCParams } from "./rpc";

type RPCParams<T extends (params: any) => any> =
	Parameters<T>[0] extends SharedRPCParams
		? Omit<Parameters<T>[0], "abort">
		: never;

export const QueryKeys = {
	appointment: "appointment",
	appointments: "appointments",
} as const;

export const Queries = {
	listAppointments: ({
		cursor,
		...params
	}: RPCParams<typeof RPC.listAppointments>) =>
		infiniteQueryOptions({
			queryKey: [QueryKeys.appointments, params] as const,
			initialPageParam: cursor ?? "",
			queryFn: async ({ signal, pageParam }) => {
				const cursor = pageParam === "" ? undefined : pageParam;
				return await Result.unwrapAsync(
					RPC.listAppointments({ ...params, cursor, abort: signal }),
				);
			},
			getNextPageParam: (lastPage) => lastPage.next_cursor,
		}),
};
