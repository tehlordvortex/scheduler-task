import { LucideLoader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function PageLoader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			{...props}
			className={cn(
				"w-full h-full grow flex items-center justify-center",
				className,
			)}
		>
			<LucideLoader2 className="animate-spin" />
		</div>
	);
}

export { PageLoader };
