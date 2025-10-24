import { QueryKeys } from "@/lib/queries";
import { Result } from "@/lib/result";
import { RPC } from "@/lib/rpc";
import { useQuery } from "@tanstack/react-query";

export function useSubscribeAndInvalidateCache() {
	const query = useQuery({
		queryKey: ["subscription"],
		queryFn: async ({ client, signal }) => {
			return Result.unwrap(
				await RPC.subscribeToEvents({
					callback() {
						client.invalidateQueries({
							queryKey: [QueryKeys.appointment],
						});
						client.invalidateQueries({
							queryKey: [QueryKeys.appointments],
						});
					},
					abort: signal,
				}),
			);
		},
		retry: true,
	});
}
