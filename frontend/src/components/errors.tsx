import { useQueryClient } from "@tanstack/react-query";
import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { Copy, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";

export function DefaultErrorComponent({
	error,
	info,
	reset,
}: ErrorComponentProps) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const errorData = {
		rawError: error,
		error: "message" in error ? error.message : String(error),
		stack: error.stack,
		cause: error.cause,
		info,
		userAgent: navigator.userAgent,
	};

	return (
		<div className="flex flex-col items-center gap-6 max-w-sm w-full mx-auto px-box py-4">
			<p className="font-bold text-gray-900 text-3xl lg:text-5xl">:(</p>
			<p className="font-bold text-gray-900 text-2xl lg:text-4xl">
				Something went wrong
			</p>
			<p className="text-gray-500">We encountered an error, apologies.</p>
			<div className="flex gap-4">
				<Button
					onClick={async () => {
						queryClient.invalidateQueries();
						router.invalidate();
						reset();
					}}
				>
					<RefreshCcw stroke="currentColor" size="1em" />
					Try again
				</Button>
				<Button
					variant="outline"
					onClick={async () => {
						const encoded = JSON.stringify(errorData);

						await navigator.clipboard.writeText(encoded);
						toast.success("Copied to clipboard");
					}}
				>
					<Copy stroke="currentColor" size="1em" />
					Copy debug info
				</Button>
			</div>
		</div>
	);
}
