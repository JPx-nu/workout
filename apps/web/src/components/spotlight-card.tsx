"use client";

import { type CSSProperties, type ReactNode, useCallback, useRef } from "react";

interface SpotlightCardProps {
	children: ReactNode;
	className?: string;
	style?: CSSProperties;
}

/**
 * Glass card with a subtle cursor-following spotlight effect on hover.
 * Renders as a regular glass-card on touch devices (no mouse tracking).
 */
export function SpotlightCard({ children, className = "", style }: SpotlightCardProps) {
	const ref = useRef<HTMLDivElement>(null);

	const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
		const el = ref.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		el.style.setProperty("--spotlight-x", `${x}px`);
		el.style.setProperty("--spotlight-y", `${y}px`);
		el.style.setProperty("--spotlight-opacity", "1");
	}, []);

	const handleMouseLeave = useCallback(() => {
		ref.current?.style.setProperty("--spotlight-opacity", "0");
	}, []);

	return (
		<div
			ref={ref}
			className={`glass-card glass-card-spotlight ${className}`}
			style={style}
			onMouseMove={handleMouseMove}
			onMouseLeave={handleMouseLeave}
		>
			{children}
		</div>
	);
}
