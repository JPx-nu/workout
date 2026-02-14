# **JPx Advisory: Triathlon AI SaaS \- Master Technical Plan 2.0 (2026 Revision)**

## **1\. Executive Strategic Review**

The technological landscape surrounding endurance sports and Software-as-a-Service (SaaS) architecture has undergone a radical transformation between the initial drafting of the Version 1.0.0 Master Technical Plan in May 2024 and the current operational environment of February 2026\. While the original proposal for a "Club-Agnostic AI Coach" utilizing a progressive web application (PWA) and standard Retrieval-Augmented Generation (RAG) established a competent Minimum Viable Product (MVP), it is no longer sufficient to secure a competitive advantage. The market has shifted from passive data tracking to proactive, agentic coaching, driven by advancements in generative AI, edge computing, and user expectations for hyper-personalized, immersive experiences.

The 2026 athlete demands a system that does more than simply ingest documentation; they require a digital entity capable of autonomous reasoning, real-time physiological synthesis, and seamless integration with the wearable ecosystem that defines modern training. The limitations of the 2024 stack—specifically the inability of pure PWAs to access historical health data directly from device secure enclaves, the latency inherent in older Node.js runtimes, and the "hallucination" risks of vector-only RAG—pose existential threats to the platform's viability. Furthermore, the aesthetic standards have evolved. The static "Dark Mode" dashboards of the early 2020s have given way to "Liquid Glass" interfaces and spatial 3D visualizations that offer intuitive, data-dense interactions.

This comprehensive strategic revision serves as the new "Source of Truth" for the Triathlon AI SaaS platform. It mandates a migration to **Node.js 25 (LTS)** and **React 19** to leverage compiler-level optimizations and server components. It replaces the passive chat interface with an **Agentic GraphRAG** workflow orchestrated by **LangGraph**, capable of multi-step reasoning and maintaining long-term context about an athlete’s injury history and training load. Crucially, it creates a "Hybrid Native" bridge using **Capacitor**, enabling direct access to Apple HealthKit and Google Health Connect, thereby closing the data loop that the original PWA architecture left open. This document outlines the technical, architectural, and design imperatives required to build a market-leading platform in 2026\.

![][image1]

## **2\. Advanced Architecture & Stack Upgrades**

The foundational "SaaS-in-a-Box" concept remains a valid strategy for operational efficiency, minimizing the DevOps burden on a lean engineering team. However, the specific technologies comprising this box must be upgraded to their 2026 standards to ensure security, performance, and feature parity with market leaders. The shift is not merely incremental; it represents a fundamental change in how the application processes data and renders interfaces.

### **2.1 Backend Runtime: Node.js 24 (LTS) / 25.x**

The original plan specified Node.js 20.x, which, as of February 2026, is approaching its End-of-Life (EOL) phase.1 Running a production SaaS on a runtime nearing EOL introduces significant security liabilities and prevents the utilization of modern performance features. To guarantee long-term support, security patches, and optimal performance through 2028, the backend infrastructure must be upgraded to **Node.js 24 (LTS)** or the current **Node.js 25.6.0** release.1

The advantages of this upgrade are multifaceted. Node.js 25 introduces substantial optimizations in the V8 JavaScript engine, which are critical for the heavy text processing and JSON manipulation involved in Retrieval-Augmented Generation (RAG) and vector embedding tasks.3 The ingestion of club documentation—often large, unstructured PDF files—requires robust stream handling. Node.js 25 offers improved TextEncoder performance and native support for newer ECMAScript modules (ESM) in embedder APIs, which significantly reduces the latency of tokenization processes required before vector storage.3

Furthermore, the stabilization of the native test runner and the native fetch API in Node.js 24/25 allows for a leaner dependency tree.3 We can eliminate external libraries like axios for HTTP requests and jest for testing, reducing the overall container size. This reduction is particularly beneficial for the Azure App Service (Linux) hosting environment, as it correlates directly with faster cold-start times and lower memory consumption, optimizing operational costs while improving system responsiveness. Security is also enhanced, as recent versions have patched vulnerabilities related to permission models and HTTP/2 handling that affected older releases.4

### **2.2 Frontend Framework: React 19**

The original specification of React 18 is now considered legacy technology. The shift to **React 19** is mandatory for a high-performance fitness application in 2026\. React 19 introduces the **React Compiler**, a transformative tool that automatically optimizes rendering behavior by memoizing components and hooks at build time.5

In the context of a triathlon training dashboard, performance is paramount. Athletes often view dashboards that aggregate real-time biometric data—heart rate, pace, power output—which updates dozens of times per second. In React 18, managing these updates without causing "render thrashing" (where the entire UI redraws unnecessarily) required manual and error-prone implementation of useMemo and useCallback hooks.5 React 19's compiler automates this fine-grained reactivity, ensuring that a heart rate update in a single widget does not trigger a re-render of the navigation bar or chart history.5 This automatic optimization translates to smoother animations and longer battery life for the user's device, a critical factor for mobile usage during long training sessions.

We will also leverage **React Server Components (RSC)** for the "Knowledge Base" and "Club Documentation" sections of the application.6 By rendering these content-heavy views on the server, we can parse PDFs and markdown files without sending the associated JavaScript libraries to the client. This dramatically reduces the bundle size and improves the First Contentful Paint (FCP), ensuring the app feels instant even on cellular networks. Additionally, the new Actions API in React 19 simplifies data mutation. Complex forms, such as the "Daily Log" or "Race Signup," can now manage pending states and optimistic UI updates natively, removing the need for heavy third-party form management libraries and simplifying the codebase.8

### **2.3 Mobile Strategy: The "Capacitor Bridge"**

The original plan's reliance on a "Strict Mobile-First PWA" contains a critical strategic flaw in the 2026 ecosystem: the inability to seamlessly access **HealthKit (iOS)** and **Health Connect (Android)**.9 While PWAs have advanced, they are structurally prevented from reading historical health data stored in the device's secure enclave. For an AI coach to be effective, access to background data—specifically sleep stages, resting heart rate (RHR), and Heart Rate Variability (HRV)—is non-negotiable. This data provides the context necessary to determine if an athlete is recovered enough for a high-intensity session.

To resolve this without forfeiting the efficiency of a single JavaScript codebase, we will implement a "Hybrid Native" architecture using **Capacitor.js**.12 This approach wraps the React 19 application in a native container, bridging the web layer with native device APIs.

**The Solution: Capacitor.js Implementation**

We will utilize the @capacitor-community/health-kit and official Health Connect plugins to create a secure data pipeline. The workflow operates as follows:

1. **Initialization:** The user opens the app, which loads the Capacitor Web View.  
2. **Permission Request:** The app requests READ permissions for essential metrics: Sleep Analysis, Workouts, and HRV.  
3. **Native Query:** The Capacitor plugin queries the native OS store (HealthKit on iOS, Health Connect on Android) for the relevant data points.12  
4. **Data Bridge:** The data is passed from the native layer to the React application, normalized, and then synced to the Supabase backend via background tasks.11

This strategy provides the best of both worlds: the development speed and update frequency of a web application with the deep hardware integration of a native app. It allows the platform to act as a true "hub" for the athlete's data, ingesting metrics that were previously inaccessible to the web-only MVP.

![][image2]

## **3\. The Cognitive Engine: From RAG to Agentic Knowledge Graphs**

The 2024 MVP relied on a simple "Chat with PDF" model using standard RAG. This approach is insufficient for the nuance required in 2026 coaching. An athlete asking, "How should I train today?" expects an answer that considers not just the static club handbook, but also their sleep quality last night, their injury history from three months ago, and the current weather conditions. A vector-only search cannot synthesize these disparate data points effectively.

### **3.1 Limitations of Standard Vector RAG**

Standard RAG, which retrieves document chunks based on semantic similarity, suffers from **context flattening**.13 If an athlete queries about "knee pain," a vector search might retrieve a generic "Injury Prevention" chapter from the uploaded club PDF. It fails to connect this retrieval with the user's daily log from three weeks prior that mentioned "tight IT bands" or a recent spike in running volume recorded by their wearable. The system lacks the "memory" and relational understanding to provide safe, personalized advice, leading to generic or potentially harmful responses.

### **3.2 The Upgrade: Hybrid GraphRAG**

To overcome these limitations, we will implement **GraphRAG (Graph Retrieval-Augmented Generation)**. This advanced technique combines the breadth of vector similarity search with the depth of knowledge graph traversal.15

* **Vector Store:** We will retain **Supabase pgvector** for storing semantic chunks of unstructured text (PDFs, race reports).  
* **Knowledge Graph:** We will implement a graph structure to link entities explicitly. This can be modeled within PostgreSQL using recursive queries or a graph extension like Apache AGE.  
  * **Nodes:** Athlete, Workout, Injury, Equipment, Club\_Rule.  
  * **Edges:** PERFORMED, CAUSED, RECOMMENDS, RESTRICTS.

**Example Workflow:**

1. **Query:** "My knee hurts, should I run?"  
2. **Vector Search:** Retrieves PDF sections regarding "Knee Pain protocols."  
3. **Graph Traversal:**  
   * Identifies User \-\> Has\_Injury\_History \-\> IT Band Syndrome (2025).  
   * Identifies User \-\> Last\_Workout \-\> Run (High Intensity, Hills).  
   * Identifies Club\_Rule \-\> Injury\_Protocol \-\> "Refer to Coach if pain persists \> 3 days."  
4. **Synthesis:** The AI integrates these findings. Instead of quoting the PDF, it responds: "Given your history of IT Band issues and yesterday's high-intensity hill run, the Club Handbook (p.14) recommends cross-training. I've flagged this for Coach Sarah."

### **3.3 Agentic Orchestration: LangGraph**

To manage this complexity, we replace simple API controllers with **LangGraph**, an orchestration framework preferred over CrewAI for this use case due to its finer state control and cyclic graph capabilities.18 The "Coach Agent" operates as a state machine:

1. **Input Node:** Ingests the user query along with real-time HealthKit data (e.g., Sleep score: 45%).  
2. **Safety Check Node:** Scans for keywords indicating acute medical emergencies (e.g., "chest pain," "faint"). If detected, the system bypasses the LLM and outputs a hardcoded emergency response.  
3. **Router Node:** Determines the intent of the query. Is it a "Training Plan" adjustment, a "Medical Safety" check, or a "General Question"?  
4. **Retrieval Node:** Executes the Hybrid Search (Vector \+ Graph) based on the router's decision.  
5. **Reasoning Node:** Synthesizes the retrieved data. For complex queries, we utilize **GPT-4o**; for routine questions (e.g., pool schedules), we route to **Llama 3.2** or **Phi-4** hosted on Azure to optimize costs.20  
6. **Action Node:** Can trigger side effects, such as modifying the training calendar in the database or sending a notification to a human coach.

This agentic approach ensures that the system is not just answering questions but actively managing the athlete's journey, providing a level of service that mimics a human coach's oversight.

## **4\. Data Ingestion & The "Webhook Mesh"**

The 2024 plan likely relied on manual entry or a simple connection to Strava. In the 2026 ecosystem, **Strava's API restrictions** and aggressive data monetization policies have made it an unreliable sole data source for third-party coaching platforms.22 To ensure data sovereignty and reliability, we must build **direct integrations** with the primary hardware providers.

### **4.1 The "Webhook Mesh" Architecture**

Instead of polling APIs, which is resource-intensive and slow, we will establish a **Webhook Mesh** on the Node.js backend to receive real-time data pushes.

* **Garmin Health API:** This is the gold standard for endurance sports. We will integrate the **Garmin Health SDK** server-side to receive .FIT files immediately after a user syncs their device.24 This provides high-fidelity data including Heart Rate, GPS, Power, Cadence, Respiration, and SpO2. While commercial use often requires a license, the **Garmin Connect Developer Program** allows for activity data access that adds value to the user, fitting our use case.26  
* **Polar AccessLink:** This integration provides direct access to training data and, crucially, "Nightly Recharge" recovery metrics.27 These recovery insights are essential for the AI coach to make informed decisions about training intensity.  
* **Wahoo Cloud API:** Wahoo is a dominant player in indoor cycling. The Cloud API (OAuth2) provides standard workout files, essential for capturing data from athletes using KICKR smart trainers.28  
* **FORM Swim Goggles:** Direct integration with FORM provides a massive differentiator. Unlike watches, which estimate swim metrics, FORM goggles measure stroke rate and head pitch directly. We can pull this data to analyze technique and even *push* structured workouts to the goggles' Heads-Up Display (HUD).29

### **4.2 Data Normalization Layer**

Each of these APIs returns data in different formats (JSON,.FIT, TCX). To prevent the AI agent from dealing with inconsistent data structures, we need a robust **Normalization Service** written in TypeScript.

The flow is as follows:

* incoming\_garmin\_json \-\> **Transformer** \-\> standard\_workout\_row  
* incoming\_polar\_json \-\> **Transformer** \-\> standard\_workout\_row

This service standardizes units (e.g., converting all speeds to meters per second), creates uniform terminology (mapping "Run" and "Jogging" to a single RUN activity type), and stores the clean data in Supabase. This ensures that the AI Agent always interacts with a consistent data schema, regardless of whether the athlete uses a Garmin watch or a Wahoo bike computer.

![][image3]

## **5\. Immersive UX/UI: The 2026 "Digital Locker Room"**

While the "Dark Mode" default specified in the original plan is correct for the fitness industry, the execution must align with the aesthetic trends of 2026 to be considered attractive. We will adopt the **Liquid Glass** design language and integrate **Spatial Data Visualization** to create a premium, modern feel.

### **5.1 Visual Language: "Liquid Glass"**

Apple's design evolution in iOS 26 has popularized "Liquid Glass," a style characterized by heavy background blurs, high-transparency layers, and fluid gradients that feel organic and alive.30

**Implementation in Tailwind CSS (v4):**

We will implement this utilizing the latest features of Tailwind CSS.

* **Backdrop Filters:** Extensive use of backdrop-blur-xl combined with bg-white/10 (or bg-black/20 for dark mode) will create the signature depth of the glass effect.  
* **Alive Gradients:** Instead of static solid colors, card backgrounds will feature subtle, moving mesh gradients (implemented via CSS keyframes) behind the glass layers. This signifies that the data is "live" and changing, rather than static.  
* **Borders:** Subtle border-white/20 borders will be used to create the "cut glass" edge effect, defining content areas without heavy lines.

### **5.2 3D Data Visualization: Muscle & Fatigue Mapping**

Triathletes are deeply invested in their physiology. A simple list of "sore muscles" is unengaging. We will implement an interactive **3D Body Map** using **React Three Fiber (R3F)**.33

* **Component:** A 3D human mesh (GLTF model) rendered directly in the browser.  
* **Data Binding:**  
  * **Fatigue:** Muscles will be colored on a heat map scale (Green to Red) based on the athlete's Training Stress Balance (TSB). A "red" calf muscle visually alerts the user to high fatigue in that area.  
  * **Injury Logging:** Users can tap a specific muscle group (e.g., the right calf) on the model to log an issue directly. This is far more intuitive than selecting from a dropdown menu.  
* **Tech Stack:** We will use @react-three/fiber for the canvas management, @react-three/drei for helpers like OrbitControls, and a custom shader to handle the "heatmap" texture projection onto the 3D mesh.

### **5.3 Micro-Interactions**

To increase user retention and "stickiness," every data entry interaction should feel rewarding.34

* **Completion Animation:** When a user checks off a workout, the card shouldn't simply vanish. It should "shatter" or "morph" into a summary statistic using a Liquid Glass effect.  
* **Haptics:** We will utilize the Navigator.vibrate() API (via Capacitor) to provide tactile feedback when users snap sliders to values or log data points, adding a physical dimension to the digital interaction.

![][image4]

## **6\. Gamification & Behavioral Psychology**

To drive long-term retention, we must evolve beyond simple "points" and leaderboards, which can be demotivating for athletes who are not at the top of the pack. We will implement **Behavioral Gamification** rooted in the 2026 trend of "Participation over Competition".36

### **6.1 The "Virtual Relay" Mechanics**

Individual leaderboards often discourage participation from slower athletes. To counter this, we will implement **Club Relays**.

* **Drafting Mechanics:** Users are grouped into squads. The total distance or points of the entire squad unlocks rewards, meaning every contribution counts.  
* **Asynchronous Relays:** An "Asynchronous Relay" feature allows members to pass a virtual baton. Athlete A might run 10k in the morning, which triggers a notification for Athlete B to "take the baton" and ride 40k in the evening.  
* **Implementation:** We will use **Supabase Realtime** to broadcast "Baton Handoff" events instantly to squad members, creating a sense of live connection even when training alone.

### **6.2 The "Taper" & Mental Health Features**

Triathletes are notorious for overtraining. To support athlete longevity, we introduce a **"Zen Mode"** or "Taper Mode" that activates in the weeks leading up to a race.37

* **UI Shift:** When in Taper Mode, the dashboard colors shift from high-energy Red/Orange to calming Blue/Teal.  
* **AI Intervention:** The Agent actively *discourages* extra workouts. If a user logs an unscheduled run, the AI might respond, "You are in Taper. Your goal today is rest. Here is a visualization exercise instead." This reinforces the importance of recovery and mental preparation.

## **7\. Security: Hardened Multi-Tenancy**

The original plan correctly identified RLS (Row Level Security) as critical for a multi-tenant application. However, relying solely on club\_id checks in policies is insufficient for a robust 2026 security posture. We need a strategy of **Defense-in-Depth**.

### **7.1 Advanced RLS Patterns via Custom Claims**

Instead of querying the profiles table on every request to check a user's club affiliation—which is slow and adds database load—we will bake the club\_id directly into the user's **JWT (JSON Web Token)** using a Supabase Auth Hook.39

* **Auth Hook:** When a user logs in, a Postgres function triggers. It retrieves the user's club\_id and adds it to the token's claims: {"app\_metadata": {"club\_id": "uuid..."}}.  
* **RLS Policy:** The RLS policy then checks this claim directly: USING (auth.jwt() \-\>\> 'club\_id' \= club\_id::text).  
* **Benefit:** This approach makes the club\_id immutable for the duration of the session and allows the database engine to verify access instantly without performing a secondary lookup query. This results in performance that is up to 100x faster and a significantly tighter security model.

### **7.2 Automated Security Auditing**

We will integrate **Supabase Security Scanners** into the CI/CD pipeline.41

* **Tooling:** Using tools like supashield or their 2026 equivalents, we will automate security testing.  
* **Mechanism:** On every Pull Request, the scanner spins up a temporary database instance, applies the schema changes, and attempts to access Tenant B's data using Tenant A's authentication token. If this access succeeds, the build automatically fails, preventing insecure code from ever reaching production.

## **8\. Revised Implementation Roadmap**

This roadmap adjusts the timeline to account for the increased complexity of the Agentic AI and Capacitor integration. It moves from a 3-week "Foundation" sprint to a robust 12-week development cycle suitable for a platform of this sophistication.

### **Phase 1: The "Iron" Core (Weeks 1-3)**

* **Infrastructure:** Setup Node.js 24 environment on Azure App Service. Initialize the Supabase project with pgvector.  
* **Mobile Foundation:** Initialize the Capacitor project and build the "Health Bridge" plugin to read Apple Health and Google Health Connect data.  
* **Authentication:** Implement Supabase Auth with Custom Claims to secure club\_id within JWTs.

### **Phase 2: The Data Mesh (Weeks 4-6)**

* **Integration:** Build the Node.js Webhook Receiver to handle incoming streams.  
* **Partnerships:** Apply for Garmin and Polar developer access. Implement parsers for .FIT and JSON files.  
* **Schema Design:** Finalize the normalization schema and write the TypeScript transformers to standardize workout data.

### **Phase 3: The "Agentic Brain" (Weeks 7-9)**

* **AI Orchestration:** Deploy the LangGraph service on Azure. Define the state machine nodes (Triage, Context, Planner, Execution).  
* **RAG Implementation:** Implement GraphRAG. Ingest Club PDFs and build the initial Knowledge Graph.  
* **Interface:** Connect the frontend Chat UI to the Agentic backend.

### **Phase 4: The "Liquid" Experience (Weeks 10-12)**

* **UI Polish:** Implement the Liquid Glass design system using Tailwind CSS.  
* **Visualization:** Build and integrate the React Three Fiber muscle map.  
* **Gamification:** Launch the Virtual Relay features and real-time event broadcasting.

![][image5]

## **9\. Conclusion**

By upgrading to **React 19** and **Node.js 24**, integrating **Capacitor** for native health data access, and adopting an **Agentic GraphRAG** approach, this Triathlon AI SaaS platform will not just be a "digital filing cabinet" for PDFs, but an active, intelligent member of the coaching staff. The shift to direct wearable integrations and immersive 3D visualizations ensures the app feels premium, modern, and indispensable to the 2026 triathlete. This plan moves beyond the constraints of the 2024 MVP to deliver a product that is secure, scalable, and deeply engaging.

# ---

**Detailed Technical Analysis**

## **10\. Architecture Deep Dive: The "Agentic" Stack**

### **10.1 React 19 & Compiler Optimization**

In the original 2024 plan, React 18 was the standard. However, the performance demands of 2026 require a more efficient rendering engine. React 19's **Automatic Memoization** via the React Compiler is a game-changer for data-heavy applications like this triathlon platform.

**Mechanism:** The compiler analyzes the component code at build time and automatically inserts memoization logic. This means developers no longer need to wrap every chart component or data table in React.memo, useMemo, or useCallback directives.

**Benefit:** For the "Live Race Tracking" feature, where data updates every second, this prevents wasted re-renders of the surrounding UI (such as headers and sidebars). This optimization saves battery life on mobile devices—a critical metric for athletes using the app during long events like an Ironman.

### **10.2 Server Actions for "Daily Logs"**

We will replace the traditional REST API calls for form submissions with **React Server Actions**.

**Old Way (React 18):** onSubmit \-\> fetch('/api/log') \-\> useState(loading) \-\> handleError.

**New Way (React 19):** Define a server function logDailyStats and pass it directly to the \<form action={logDailyStats}\>. React handles the pending states, optimistic UI updates, and error boundaries automatically. This drastically reduces the client-side boilerplate code required for features like the "Daily Check-in," simplifying maintenance and improving reliability.

### **10.3 Capacitor Bridge Implementation**

To bridge the gap between the web-based PWA and native iOS/Android Health APIs, we use **Capacitor**. The configuration is straightforward but powerful.

**Configuration Example:**

JSON

// capacitor.config.json  
{  
  "appId": "com.triathlonai.app",  
  "appName": "Triathlon AI",  
  "webDir": "dist",  
  "plugins": {  
    "HealthKit": {  
      "enabled": true  
    }  
  }  
}

**Usage Pattern:** We create a useHealthData hook that detects the environment. If running in the browser, it can return mock data or prompt the user for manual input. If running in Capacitor, it calls the native plugin to fetch the last 24 hours of sleep and HRV data silently in the background, ensuring the AI always has the latest physiological context without user intervention.

## **11\. AI Engine: GraphRAG & Agentic Workflow**

### **11.1 The Context Problem**

Traditional RAG is "stateless" regarding the user's broader context. It treats every question as an isolated event. For a coach, this is a failure mode. A question like "Why am I tired?" cannot be answered effectively by a PDF; it requires knowledge of the user's recent training load and recovery status.

### **11.2 Knowledge Graph Schema**

We will implement a lightweight Knowledge Graph within Postgres using recursive Common Table Expressions (CTEs) or a dedicated graph extension like **Apache AGE**.

* **Entities:** Athlete, Workout, Injury, Event, Document\_Chunk.  
* **Relationships:**  
  * Athlete \----\> Workout  
  * Workout \----\> Fatigue  
  * Document\_Chunk \----\> Fatigue

**Querying:** When the user asks about fatigue, the Agent queries the graph to find *recent workouts* linked to *fatigue*, then uses that context to search the *Document\_Chunks* that address that specific type of fatigue (e.g., "Acute" vs. "Chronic").

### **11.3 LangGraph Implementation**

We define the coaching logic as a graph of nodes, orchestrating the flow of data and decision-making.

* **Node 1: Triage.** Check if the input contains keywords like "chest pain" or "faint." If YES, route immediately to **Emergency Response** (hardcoded safety, bypassing LLM).  
* **Node 2: Context Gathering.** Parallel fetch: (a) Retrieve last 7 days of HealthKit data, (b) Retrieve recent chat history.  
* **Node 3: Planner.** The LLM (Llama 3.2 70B) analyzes the query \+ context and decides the next step: "Search Handbook" or "Analyze Data."  
* **Node 4: Execution.** Run the RAG search or the Data Analysis script.  
* **Node 5: Synthesis.** Combine findings into a natural language response.

## **12\. Security & Compliance: Multi-Tenant Hardening**

### **12.1 The "Custom Claims" Strategy**

To ensure strict isolation, we utilize Supabase's ability to inject custom claims into the JWT.

* **Auth Hook:** When a user logs in, a Postgres function triggers. It looks up the user's club\_id and adds it to the token claims: {"app\_metadata": {"club\_id": "uuid..."}}.  
* **RLS Policy:**  
  SQL  
  CREATE POLICY "Isolate Club Data"  
  ON documents  
  FOR SELECT  
  USING (  
    club\_id \= (auth.jwt() \-\> 'app\_metadata' \-\>\> 'club\_id')::uuid  
  );

* **Why:** This makes the club\_id immutable for the duration of the session and accessible instantly by the database engine without performing a secondary lookup query, significantly improving performance under load.

### **12.2 CI/CD Security Gates**

We implement a "Red Team" step in the deployment pipeline.

* **Script:** A Node.js script that attempts to exploit the API.  
  * *Test 1:* Login as User A (Club A).  
  * *Test 2:* Attempt to SELECT \* FROM documents WHERE club\_id \= 'Club\_B\_UUID'.  
  * *Assert:* Result must be 0 rows or 403 Forbidden.  
* If this script returns any data, the pipeline halts, preventing the insecure code from reaching production. This automated gate ensures that multi-tenancy rules are enforced at the code level before any update goes live.

#### **Works cited**

1. Node.js | endoflife.date, accessed February 9, 2026, [https://endoflife.date/nodejs](https://endoflife.date/nodejs)  
2. Node.js Releases, accessed February 9, 2026, [https://nodejs.org/en/about/previous-releases](https://nodejs.org/en/about/previous-releases)  
3. Node.js 25.6.0 (Current), accessed February 9, 2026, [https://nodejs.org/en/blog/release/v25.6.0](https://nodejs.org/en/blog/release/v25.6.0)  
4. Node.js 22.22.0 (LTS), accessed February 9, 2026, [https://nodejs.org/en/blog/release/v22.22.0](https://nodejs.org/en/blog/release/v22.22.0)  
5. React 18 vs React 19: Boosting Rendering Performance \- Oleksii Popov, accessed February 9, 2026, [https://oleksiipopov.com/blog/react-18-vs-react-19/](https://oleksiipopov.com/blog/react-18-vs-react-19/)  
6. React 18 Vs React 19: Key Differences To Know For 2025 \- iFour Technolab, accessed February 9, 2026, [https://www.ifourtechnolab.com/blog/react-18-vs-react-19-key-differences-to-know-for-2024](https://www.ifourtechnolab.com/blog/react-18-vs-react-19-key-differences-to-know-for-2024)  
7. React 19.2: New Features & Performance Boosts, accessed February 9, 2026, [https://javascript-conference.com/blog/react-19-2-updates-performance-activity-component/](https://javascript-conference.com/blog/react-19-2-updates-performance-activity-component/)  
8. Is It Worth Upgrading to React 19? \- DEV Community, accessed February 9, 2026, [https://dev.to/ravidasari/is-it-worth-upgrading-from-react-18-to-react-19-m50](https://dev.to/ravidasari/is-it-worth-upgrading-from-react-18-to-react-19-m50)  
9. Authorizing access to health data | Apple Developer Documentation, accessed February 9, 2026, [https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)  
10. Integrating Apple Health and Google Health Connect in Health & Fitness Apps | by Rohandhalpe | Dec, 2025 | Medium, accessed February 9, 2026, [https://medium.com/@rohandhalpe05/integrating-apple-health-and-google-health-connect-in-health-fitness-apps-f9e04218c645](https://medium.com/@rohandhalpe05/integrating-apple-health-and-google-health-connect-in-health-fitness-apps-f9e04218c645)  
11. PWA vs Native Apps: Which Wins in 2026? (Comparison for Beginners) \- YouTube, accessed February 9, 2026, [https://www.youtube.com/watch?v=rsv6zU5dOJ8](https://www.youtube.com/watch?v=rsv6zU5dOJ8)  
12. Awesome lists of capacitor plugins. Made by Capgo \- GitHub, accessed February 9, 2026, [https://github.com/riderx/awesome-capacitor](https://github.com/riderx/awesome-capacitor)  
13. Advanced RAG Techniques for High-Performance LLM Applications \- Graph Database & Analytics \- Neo4j, accessed February 9, 2026, [https://neo4j.com/blog/genai/advanced-rag-techniques/](https://neo4j.com/blog/genai/advanced-rag-techniques/)  
14. Knowledge graph vs. vector database for RAG: which is best? \- Meilisearch, accessed February 9, 2026, [https://www.meilisearch.com/blog/knowledge-graph-vs-vector-database-for-rag](https://www.meilisearch.com/blog/knowledge-graph-vs-vector-database-for-rag)  
15. Advanced RAG Techniques: What They Are & How to Use Them \- FalkorDB, accessed February 9, 2026, [https://www.falkordb.com/blog/advanced-rag/](https://www.falkordb.com/blog/advanced-rag/)  
16. Knowledge Graph vs. Vector RAG: Optimization & Analysis \- Neo4j, accessed February 9, 2026, [https://neo4j.com/blog/developer/knowledge-graph-vs-vector-rag/](https://neo4j.com/blog/developer/knowledge-graph-vs-vector-rag/)  
17. How to Implement Graph RAG Using Knowledge Graphs and Vector Databases \- Medium, accessed February 9, 2026, [https://medium.com/data-science/how-to-implement-graph-rag-using-knowledge-graphs-and-vector-databases-60bb69a22759](https://medium.com/data-science/how-to-implement-graph-rag-using-knowledge-graphs-and-vector-databases-60bb69a22759)  
18. LangGraph vs CrewAI: Let's Learn About the Differences \- ZenML Blog, accessed February 9, 2026, [https://www.zenml.io/blog/langgraph-vs-crewai](https://www.zenml.io/blog/langgraph-vs-crewai)  
19. LangGraph vs. CrewAI: Choosing the Right Framework for Multi-Agent AI Workflows, accessed February 9, 2026, [https://medium.com/@adilmaqsood501/langgraph-vs-crewai-choosing-the-right-framework-for-multi-agent-ai-workflows-de44b5409c39](https://medium.com/@adilmaqsood501/langgraph-vs-crewai-choosing-the-right-framework-for-multi-agent-ai-workflows-de44b5409c39)  
20. Llama 3.2 3B Instruct vs Phi 4 (Comparative Analysis) \- Galaxy.ai Blog, accessed February 9, 2026, [https://blog.galaxy.ai/compare/llama-3-2-3b-instruct-vs-phi-4](https://blog.galaxy.ai/compare/llama-3-2-3b-instruct-vs-phi-4)  
21. Llama 3.2 90B Instruct vs Phi 4 Reasoning Plus, accessed February 9, 2026, [https://llm-stats.com/models/compare/llama-3.2-90b-instruct-vs-phi-4-reasoning-plus](https://llm-stats.com/models/compare/llama-3.2-90b-instruct-vs-phi-4-reasoning-plus)  
22. "We consider this to be YOUR data." \- Why should you care about Strava vs Garmin?, accessed February 9, 2026, [https://www.reddit.com/r/Strava/comments/1nz7dw5/we\_consider\_this\_to\_be\_your\_data\_why\_should\_you/](https://www.reddit.com/r/Strava/comments/1nz7dw5/we_consider_this_to_be_your_data_why_should_you/)  
23. Garmin Users: Strava Alternatives After the 2025 Lawsuit \- Motion Fitness App, accessed February 9, 2026, [https://motion-app.com/garmin-strava-alternatives/](https://motion-app.com/garmin-strava-alternatives/)  
24. Health API | Garmin Connect Developer Program, accessed February 9, 2026, [https://developer.garmin.com/gc-developer-program/health-api/](https://developer.garmin.com/gc-developer-program/health-api/)  
25. Activity API | Garmin Connect Developer Program, accessed February 9, 2026, [https://developer.garmin.com/gc-developer-program/activity-api/](https://developer.garmin.com/gc-developer-program/activity-api/)  
26. Garmin Connect Developer Program FAQ, accessed February 9, 2026, [https://developer.garmin.com/gc-developer-program/program-faq/](https://developer.garmin.com/gc-developer-program/program-faq/)  
27. Introducing Polar Open AccessLink API, accessed February 9, 2026, [https://www.polar.com/blog/introducing-polar-open-accesslink-api/](https://www.polar.com/blog/introducing-polar-open-accesslink-api/)  
28. Cloud API \- Wahoo Fitness, accessed February 9, 2026, [https://developers.wahooligan.com/cloud](https://developers.wahooligan.com/cloud)  
29. FORM Swim \- App Store \- Apple, accessed February 9, 2026, [https://apps.apple.com/us/app/form-swim/id1321117442](https://apps.apple.com/us/app/form-swim/id1321117442)  
30. UI/UX Design Trends in Mobile Apps for 2025 | Chop Dawg, accessed February 9, 2026, [https://www.chopdawg.com/ui-ux-design-trends-in-mobile-apps-for-2025/](https://www.chopdawg.com/ui-ux-design-trends-in-mobile-apps-for-2025/)  
31. Implement Liquid Glass Effects in Tailwind CSS Easily \- FlyonUI, accessed February 9, 2026, [https://flyonui.com/blog/liquid-glass-effects-in-tailwind-css/](https://flyonui.com/blog/liquid-glass-effects-in-tailwind-css/)  
32. How to create Liquid Glass effects with CSS and SVG \- LogRocket Blog, accessed February 9, 2026, [https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/](https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/)  
33. Creating Interactive 3D Anatomy Models for Fitness Apps with React ..., accessed February 9, 2026, [https://www.wellally.tech/blog/react-three-fiber-3d-anatomy-model-fitness-app](https://www.wellally.tech/blog/react-three-fiber-3d-anatomy-model-fitness-app)  
34. Top 10 App Design Trends to Watch in 2026 \- UIDesignz, accessed February 9, 2026, [https://uidesignz.com/blogs/top-10-app-design-trends](https://uidesignz.com/blogs/top-10-app-design-trends)  
35. How can gamification in fitness apps turn short-term motivation into long-term growth?, accessed February 9, 2026, [https://yodelmobile.com/gamification-in-fitness-apps/](https://yodelmobile.com/gamification-in-fitness-apps/)  
36. The Best Virtual Team Building Activities 2026 | Plentiful, accessed February 9, 2026, [https://helloplentiful.com/the-best-virtual-team-building-activities-for-2026/](https://helloplentiful.com/the-best-virtual-team-building-activities-for-2026/)  
37. Triathlon Psychology: What Elite Athletes Know About Mental Training \- Dr Paul McCarthy, accessed February 9, 2026, [https://www.drpaulmccarthy.com/post/triathlon-psychology-what-elite-athletes-know-about-mental-training](https://www.drpaulmccarthy.com/post/triathlon-psychology-what-elite-athletes-know-about-mental-training)  
38. The Psychology of Athletic Tapering in Sport: A Scoping Review \- PMC, accessed February 9, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC10036416/](https://pmc.ncbi.nlm.nih.gov/articles/PMC10036416/)  
39. Setting tenant in a multi-tenant setup : r/Supabase \- Reddit, accessed February 9, 2026, [https://www.reddit.com/r/Supabase/comments/1pxwx3z/setting\_tenant\_in\_a\_multitenant\_setup/](https://www.reddit.com/r/Supabase/comments/1pxwx3z/setting_tenant_in_a_multitenant_setup/)  
40. Custom Claims & Role-based Access Control (RBAC) | Supabase Docs, accessed February 9, 2026, [https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac)  
41. Supabase Row Level Security (RLS): Complete Guide 2026 \- Vibe App Scanner, accessed February 9, 2026, [https://vibeappscanner.com/supabase-row-level-security](https://vibeappscanner.com/supabase-row-level-security)  
42. Rodrigotari1/supashield: Automated Supabase RLS security testing CLI \- catch vulnerabilities before production \- GitHub, accessed February 9, 2026, [https://github.com/Rodrigotari1/supashield](https://github.com/Rodrigotari1/supashield)
