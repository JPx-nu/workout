import { describe, expect, it } from "vitest";
import { checkInput, classifyIntent, processOutput } from "../safety.js";

describe("checkInput", () => {
	it("passes valid input", () => {
		const result = checkInput("How should I structure my run today?");
		expect(result.passed).toBe(true);
		expect(result.blocked).toBe(false);
	});

	it("blocks empty input", () => {
		const result = checkInput("   ");
		expect(result.passed).toBe(false);
		expect(result.blocked).toBe(true);
		expect(result.reason).toBe("empty_input");
	});

	it("blocks input exceeding 4000 characters", () => {
		const result = checkInput("a".repeat(4001));
		expect(result.passed).toBe(false);
		expect(result.blocked).toBe(true);
		expect(result.reason).toBe("input_too_long");
	});

	it("allows input at exactly 4000 characters", () => {
		const result = checkInput("a".repeat(4000));
		expect(result.passed).toBe(true);
	});

	it("detects emergency keywords (exact)", () => {
		const result = checkInput("I want to kill myself");
		expect(result.blocked).toBe(true);
		expect(result.reason).toBe("emergency_detected");
		expect(result.response).toContain("90101"); // Swedish helpline
	});

	it("detects emergency keywords (case-insensitive)", () => {
		const result = checkInput("I've been having SUICIDAL thoughts");
		expect(result.blocked).toBe(true);
		expect(result.reason).toBe("emergency_detected");
	});

	it("detects emergency keywords embedded in text", () => {
		const result = checkInput("After my run I felt like there was no reason to live");
		expect(result.blocked).toBe(true);
		expect(result.reason).toBe("emergency_detected");
	});

	it("does not false-positive on training content", () => {
		const result = checkInput("I want to kill it in my next race!");
		// "kill" alone is not in the keyword list — "kill myself" is
		expect(result.passed).toBe(true);
	});

	it("detects self-harm keywords", () => {
		expect(checkInput("I've been cutting myself").blocked).toBe(true);
		expect(checkInput("thinking about self-harm").blocked).toBe(true);
		expect(checkInput("self harm tendencies").blocked).toBe(true);
	});
});

describe("processOutput", () => {
	it("returns content unchanged when no medical content", () => {
		const result = processOutput("Great job on your 5k run today!");
		expect(result.content).toBe("Great job on your 5k run today!");
		expect(result.disclaimerAdded).toBe(false);
		expect(result.lowConfidence).toBe(false);
	});

	it("adds medical disclaimer when medical keywords detected", () => {
		const result = processOutput("Your heart rate indicates a possible condition");
		expect(result.disclaimerAdded).toBe(true);
		expect(result.content).toContain("not medical advice");
	});

	it("adds medical disclaimer when hasMedicalContent flag is true", () => {
		const result = processOutput("Here is your plan", { hasMedicalContent: true });
		expect(result.disclaimerAdded).toBe(true);
		expect(result.content).toContain("not medical advice");
	});

	it("skips medical disclaimer when hasMedicalContent is explicitly false", () => {
		const result = processOutput("Check your heart rate zones", {
			hasMedicalContent: false,
		});
		expect(result.disclaimerAdded).toBe(false);
	});

	it("adds low confidence warning when confidence < 0.6", () => {
		const result = processOutput("You might try intervals", { confidence: 0.5 });
		expect(result.lowConfidence).toBe(true);
		expect(result.content).toContain("limited data");
	});

	it("does not add low confidence warning when confidence >= 0.6", () => {
		const result = processOutput("You should do 3x10min intervals", { confidence: 0.8 });
		expect(result.lowConfidence).toBe(false);
	});

	it("adds both disclaimers when applicable", () => {
		const result = processOutput("Your injury pain may need treatment", {
			confidence: 0.3,
		});
		expect(result.disclaimerAdded).toBe(true);
		expect(result.lowConfidence).toBe(true);
		expect(result.content).toContain("not medical advice");
		expect(result.content).toContain("limited data");
	});
});

describe("classifyIntent", () => {
	it("classifies emergency content", () => {
		expect(classifyIntent("I want to end my life")).toBe("emergency");
		expect(classifyIntent("having suicidal thoughts")).toBe("emergency");
	});

	it("classifies medical content", () => {
		expect(classifyIntent("I need a diagnosis for my knee")).toBe("medical");
		expect(classifyIntent("What supplement should I take?")).toBe("medical");
		expect(classifyIntent("My blood pressure is high")).toBe("medical");
	});

	it("classifies training content", () => {
		expect(classifyIntent("What pace should I aim for?")).toBe("training");
		expect(classifyIntent("Plan my next interval workout")).toBe("training");
		expect(classifyIntent("What's my FTP zone?")).toBe("training");
		expect(classifyIntent("Should I taper before the race?")).toBe("training");
	});

	it("classifies general content", () => {
		expect(classifyIntent("Hello, how are you?")).toBe("general");
		expect(classifyIntent("What's the weather like?")).toBe("general");
	});

	it("prioritizes emergency over medical", () => {
		// Contains both "medication" (medical) and "overdose" (emergency)
		expect(classifyIntent("I took an overdose of medication")).toBe("emergency");
	});

	it("prioritizes medical over training", () => {
		// Contains both "pain" (medical) and "run" (training)
		expect(classifyIntent("I have pain when I run")).toBe("medical");
	});
});
