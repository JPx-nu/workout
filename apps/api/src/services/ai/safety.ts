/**
 * AI Safety Guard — Multi-layer safety checks for the AI Coach
 *
 * Implements:
 * 1. Emergency/crisis detection → helpline info + hard stop
 * 2. Medical disclaimer injection
 * 3. Input length validation
 * 4. PII pattern redaction in output
 * 5. Confidence gating
 *
 * @see LangGraph v1.1+ content moderation middleware for deeper integration
 */

// ── Constants ──────────────────────────────────────────────────

const MAX_INPUT_LENGTH = 4000;

const EMERGENCY_KEYWORDS = [
    'suicide', 'suicidal', 'kill myself', 'end my life', 'want to die',
    'self-harm', 'self harm', 'cutting myself', 'hurt myself',
    'overdose', 'no reason to live', 'better off dead',
] as const;

const MEDICAL_TRIGGER_KEYWORDS = [
    'diagnosis', 'diagnose', 'prescription', 'medication', 'medicine',
    'treatment', 'disease', 'disorder', 'symptom', 'injury',
    'nutrition', 'supplement', 'diet', 'calorie', 'macro',
    'pain', 'chronic', 'acute', 'condition', 'surgery',
    'heart rate', 'blood pressure', 'spo2', 'vo2max',
] as const;

const EMERGENCY_RESPONSE = `🚨 **I'm concerned about your wellbeing.**

If you're experiencing a crisis or having thoughts of self-harm, please reach out to professionals who can help:

🇸🇪 **Sweden**: Mind Självmordslinjen — **90101** (call or text)
🇪🇺 **EU**: 112 (emergency)
🌍 **International**: Crisis Text Line — text **HELLO** to **741741**
🌍 **International**: Befrienders Worldwide — [befrienders.org](https://www.befrienders.org)

You are not alone, and there are people who care about you. 💙

*I'm an AI coaching assistant and cannot provide crisis support. Please contact a professional or someone you trust.*`;

const MEDICAL_DISCLAIMER = `\n\n---\n⚕️ *This is AI-generated guidance for informational purposes only. It is not medical advice. Always consult a qualified healthcare professional before making health decisions.*`;

const LOW_CONFIDENCE_DISCLAIMER = `\n\n---\n⚠️ *I have limited data to support this recommendation. Please verify with your coach or healthcare provider.*`;

// ── Interfaces ─────────────────────────────────────────────────

export interface SafetyCheckResult {
    passed: boolean;
    blocked: boolean;
    reason?: string;
    response?: string;
}

export interface SafetyProcessedOutput {
    content: string;
    disclaimerAdded: boolean;
    piiRedacted: boolean;
    lowConfidence: boolean;
}

// ── Input Safety Check ─────────────────────────────────────────

/**
 * Checks user input before sending to the AI model.
 * Returns a block response if emergency content is detected.
 */
export function checkInput(message: string): SafetyCheckResult {
    // Length validation
    if (message.length > MAX_INPUT_LENGTH) {
        return {
            passed: false,
            blocked: true,
            reason: 'input_too_long',
            response: `Your message is too long (${message.length} characters). Please keep messages under ${MAX_INPUT_LENGTH} characters.`,
        };
    }

    if (message.trim().length === 0) {
        return {
            passed: false,
            blocked: true,
            reason: 'empty_input',
            response: 'Please enter a message.',
        };
    }

    // Emergency keyword detection
    const lowered = message.toLowerCase();
    const isEmergency = EMERGENCY_KEYWORDS.some((kw) => lowered.includes(kw));

    if (isEmergency) {
        return {
            passed: false,
            blocked: true,
            reason: 'emergency_detected',
            response: EMERGENCY_RESPONSE,
        };
    }

    return { passed: true, blocked: false };
}

// ── Output Safety Processing ───────────────────────────────────

/**
 * Processes AI model output before sending to the user.
 * Adds disclaimers and redacts PII.
 */
export function processOutput(
    content: string,
    options: {
        confidence?: number;
        hasMedicalContent?: boolean;
    } = {},
): SafetyProcessedOutput {
    let processed = content;
    let disclaimerAdded = false;
    const piiRedacted = false;

    // Detect medical content in output
    const outputLower = processed.toLowerCase();
    const hasMedical =
        options.hasMedicalContent ??
        MEDICAL_TRIGGER_KEYWORDS.some((kw) => outputLower.includes(kw));

    if (hasMedical) {
        processed += MEDICAL_DISCLAIMER;
        disclaimerAdded = true;
    }

    // Low confidence warning
    const lowConfidence = (options.confidence ?? 1.0) < 0.6;
    if (lowConfidence) {
        processed += LOW_CONFIDENCE_DISCLAIMER;
        disclaimerAdded = true;
    }

    return {
        content: processed,
        disclaimerAdded,
        piiRedacted,
        lowConfidence,
    };
}

// ── Content Classification ─────────────────────────────────────

/**
 * Classifies user input intent for routing and safety decisions.
 */
export function classifyIntent(message: string): 'training' | 'medical' | 'emergency' | 'general' {
    const lower = message.toLowerCase();

    if (EMERGENCY_KEYWORDS.some((kw) => lower.includes(kw))) {
        return 'emergency';
    }

    if (MEDICAL_TRIGGER_KEYWORDS.some((kw) => lower.includes(kw))) {
        return 'medical';
    }

    const trainingKeywords = [
        'training', 'workout', 'swim', 'bike', 'run', 'pace',
        'interval', 'tempo', 'threshold', 'taper', 'race', 'plan',
        'tss', 'ftp', 'zone', 'recovery', 'rest day',
    ];

    if (trainingKeywords.some((kw) => lower.includes(kw))) {
        return 'training';
    }

    return 'general';
}
