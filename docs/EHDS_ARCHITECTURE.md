# EHDS (European Health Data Space) Architectural Readiness

**Last Updated:** February 2026
**Status:** Readiness Planning & Phase 1 Compliance

## 1. Context & Regulatory Landscape

The European Health Data Space (EHDS) is a framework designed to empower individuals with full control over their health data and ensure interoperability across the EU. While JPx is classified as a fitness and wellness platform (not a regulated medical device), the proactive adoption of EHDS standards ensures:
1. Complete GDPR portability compliance.
2. The ability for athletes to easily share their high-fidelity biometric data (HRV, Sleep, Training Load) with their medical professionals, physios, and EHRs (Electronic Health Records) in the future.

## 2. Current Architecture (Phase 1 Readiness)

JPx has already implemented foundational requirements for EHDS compliance:

### 2.1 EU Data Sovereignty & Localization
* **Infrastructure:** 100% of the platform (Next.js, Hono API) and databases (Supabase/PostgreSQL) are hosted within the European Union (Sweden via Azure).
* **Data Flow:** Third-party integrations (e.g., Garmin, Oura) are funneled through Junction (EU) to ensure raw data doesn't exit the EEA without explicit consent.

### 2.2 Security & Zero-Trust
* **Row-Level Security (RLS):** All telemetry (e.g., `health_metrics`, `daily_logs`) is shielded by strict RLS policies.
* **OAuth Restrictions:** `AS RESTRICTIVE` policies guarantee that third-party applications or malicious actors cannot directly query the raw tables.
* **Consent UX:** Granular, explicit consent is gathered individually per device connection.

### 2.3 Data Portability
* The **Data Control Center** allows users to immediately export a complete JSON archive of all their proprietary data (training logs, biometric time-series).

## 3. Roadmap to Full EHDS Interoperability (Phase 2)

To move beyond basic JSON portability and achieve true semantic interoperability under EHDS constraints, JPx will adopt the **HL7 FHIR (Fast Healthcare Interoperability Resources)** standard for specific data exports.

### 3.1 FHIR Mapping Strategy
Biometric telemetry will be mapped to FHIR `Observation` resources.
* **HR / HRV:** Mapped using LOINC codes (e.g., `8867-4` for Heart rate).
* **Workouts:** Mapped to FHIR `Procedure` or customized `Observation` extensions for physical activity.
* **Athlete Profiles:** Mapped to FHIR `Patient` resources (anonymized/minimized as necessary).

### 3.2 Implemented Endpoints (Future)
We will introduce a dedicated export path:
```http
GET /api/v1/export/fhir
Authorization: Bearer <token>
```
Which transforms relational SQL data via the Hono API into standardized FHIR R4 JSON bundles before downloading.

### 3.3 SMART on FHIR Integration
Should JPx decide to allow direct clinical integrations in the future (e.g., an athlete's cardiologist monitoring HRV trends), we will implement a SMART on FHIR authorization server securely on top of the Supabase GoTrue Auth layer.

## 4. Conclusion

The current PostgreSQL schema and aggressive Zero-Trust isolation patterns serve as an excellent baseline. Future-proofing efforts will purely require a translation layer (Hono API -> FHIR mapping) rather than painful database migrations or structural overhauls. 
