import { Link } from "@tanstack/react-router";
import { CalendarPlus, Clock, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

export default function Header() {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<>
			<header className="p-2.5 flex items-center bg-white text-gray-950 border-b border-b-gray-300">
				<button
					type="button"
					onClick={() => setIsOpen(true)}
					className="p-2 focus-visible:bg-gray-950 focus-visible:text-white rounded-lg transition-colors"
					aria-label="Open menu"
				>
					<Menu size={24} />
				</button>
				<h1 className="ml-4 text-xl font-semibold">
					<Link to="/">Schedulr</Link>
				</h1>
				<Button asChild className="ms-auto">
					<Link to="/schedule">Book appointment</Link>
				</Button>
			</header>

			<aside
				className={`fixed top-0 left-0 h-full w-80 bg-gray-950 text-white z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
					isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
				}`}
			>
				<div className="flex items-center justify-between p-4 border-b border-gray-700">
					<h2 className="text-xl font-bold">Navigation</h2>
					<button
						type="button"
						onClick={() => setIsOpen(false)}
						className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
						aria-label="Close menu"
					>
						<X size={24} />
					</button>
				</div>

				<nav className="flex-1 p-4 overflow-y-auto">
					<Link
						to="/appointments"
						onClick={() => setIsOpen(false)}
						className="flex items-center gap-3 p-3 rounded-lg transition-colors mb-2"
						activeProps={{
							className:
								"flex items-center gap-3 p-3 rounded-lg bg-white text-gray-950 transition-colors mb-2",
						}}
					>
						<Clock size={20} />
						<span className="font-medium">Appointments</span>
					</Link>
					<Link
						to="/schedule"
						onClick={() => setIsOpen(false)}
						className="flex items-center gap-3 p-3 rounded-lg transition-colors mb-2"
						activeProps={{
							className:
								"flex items-center gap-3 p-3 rounded-lg bg-white text-gray-950 transition-colors mb-2",
						}}
					>
						<CalendarPlus size={20} />
						<span className="font-medium">Book appointment</span>
					</Link>
				</nav>
			</aside>
		</>
	);
}
