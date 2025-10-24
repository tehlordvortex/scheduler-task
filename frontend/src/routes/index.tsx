import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	async beforeLoad() {
		throw redirect({ to: "/appointments" });
	},
});
