"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
}

interface State {
	hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(): State {
		return { hasError: true };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error("ErrorBoundary caught:", error, info.componentStack);
	}

	render() {
		if (this.state.hasError) {
			return (
				this.props.fallback ?? (
					<div className="p-6 text-center text-[var(--color-text-muted)]">
						<p className="text-sm">Something went wrong loading this section.</p>
						<button
							type="button"
							onClick={() => this.setState({ hasError: false })}
							className="mt-2 text-xs underline hover:text-[var(--color-text)]"
						>
							Try again
						</button>
					</div>
				)
			);
		}

		return this.props.children;
	}
}
