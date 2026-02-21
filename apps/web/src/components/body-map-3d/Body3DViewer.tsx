"use client";

import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import * as THREE from "three";
import type { MuscleFatigue } from "@/lib/mock/health";

/* ─── Map muscle names from GLB userData → fatigue bodyPart keys ─── */
const MUSCLE_NAME_MAP: Record<string, string> = {
	"pectoralis major": "chest",
	"pectoralis minor": "chest",
	deltoid: "shoulders",
	"anterior deltoid": "shoulders",
	"lateral deltoid": "shoulders",
	"posterior deltoid": "shoulders",
	"biceps brachii": "biceps",
	brachialis: "biceps",
	"triceps brachii": "triceps",
	brachioradialis: "forearms",
	flexor: "forearms",
	extensor: "forearms",
	"rectus abdominis": "core",
	"external oblique": "core",
	"internal oblique": "core",
	"transversus abdominis": "core",
	"latissimus dorsi": "lats",
	trapezius: "traps",
	rhomboid: "lats",
	"erector spinae": "lower_back",
	infraspinatus: "shoulders",
	supraspinatus: "shoulders",
	teres: "lats",
	quadriceps: "quadriceps",
	"rectus femoris": "quadriceps",
	"vastus lateralis": "quadriceps",
	"vastus medialis": "quadriceps",
	"vastus intermedius": "quadriceps",
	"biceps femoris": "hamstrings",
	semitendinosus: "hamstrings",
	semimembranosus: "hamstrings",
	hamstring: "hamstrings",
	gastrocnemius: "calves",
	soleus: "calves",
	"tibialis anterior": "calves",
	"gluteus maximus": "glutes",
	"gluteus medius": "glutes",
	"gluteus minimus": "glutes",
	iliopsoas: "hip_flexors",
	psoas: "hip_flexors",
	adductor: "adductors",
	"adductor longus": "adductors",
	"adductor magnus": "adductors",
	gracilis: "adductors",
	sternocleidomastoid: "neck",
	scalene: "neck",
};

function findBodyPart(meshName: string): string | null {
	const lower = meshName.toLowerCase();
	for (const [key, value] of Object.entries(MUSCLE_NAME_MAP)) {
		if (lower.includes(key)) return value;
	}
	return null;
}

/* ─── Neon-glass color palette ─── */
const FATIGUE_COLORS = {
	low: { base: new THREE.Color(0x00ffa3), emissive: new THREE.Color(0x00ffa3) },
	moderate: {
		base: new THREE.Color(0xffb800),
		emissive: new THREE.Color(0xffb800),
	},
	high: {
		base: new THREE.Color(0xff3d5a),
		emissive: new THREE.Color(0xff3d5a),
	},
};

function getFatigueTheme(level: number) {
	if (level >= 70) return FATIGUE_COLORS.high;
	if (level >= 40) return FATIGUE_COLORS.moderate;
	return FATIGUE_COLORS.low;
}

/* ─── Cached muscle mesh info (avoid per-frame traverse) ─── */
interface MuscleMeshInfo {
	mesh: THREE.Mesh;
	material: THREE.MeshPhysicalMaterial;
	baseEmissiveIntensity: number;
	baseOpacity: number;
}

/* ─── Loading spinner ─── */
function Loader() {
	return (
		<Html center>
			<div
				style={{
					color: "#e2e8f0",
					fontSize: "13px",
					fontFamily: "Inter, system-ui, sans-serif",
					textAlign: "center",
					letterSpacing: "0.05em",
				}}
			>
				<div
					style={{
						width: 44,
						height: 44,
						margin: "0 auto 14px",
						border: "2px solid rgba(255,255,255,0.06)",
						borderTopColor: "#6366f1",
						borderRadius: "50%",
						animation: "spin 0.8s linear infinite",
					}}
				/>
				Initializing 3D viewer…
			</div>
		</Html>
	);
}

/* ═══════════════════════════════════════════════════
   THE BODY MODEL  — glassmorphic materials + pulse
   ═══════════════════════════════════════════════════ */
function BodyModel({
	fatigueData,
	onMeshClick,
}: {
	fatigueData: MuscleFatigue[];
	onMeshClick: (name: string, bodyPart: string | null) => void;
}) {
	const { scene } = useGLTF("/workout/models/body.glb", "/workout/draco/");
	const modelRef = useRef<THREE.Group>(null);
	const [hovered, setHovered] = useState<string | null>(null);
	const hoveredRef = useRef<string | null>(null);
	const muscleMeshesRef = useRef<MuscleMeshInfo[]>([]);
	const { gl } = useThree();

	// Keep ref in sync for useFrame
	useEffect(() => {
		hoveredRef.current = hovered;
	}, [hovered]);

	const fatigueLookup = useMemo(() => {
		const map: Record<string, number> = {};
		fatigueData.forEach((f) => {
			map[f.bodyPart] = f.level;
		});
		return map;
	}, [fatigueData]);

	/* ── Apply materials once & cache muscle mesh refs ── */
	useEffect(() => {
		const muscleMeshes: MuscleMeshInfo[] = [];

		scene.traverse((child: THREE.Object3D) => {
			if (!(child as THREE.Mesh).isMesh) return;
			const mesh = child as THREE.Mesh;
			const userData = mesh.userData as {
				type?: string;
				name?: string;
				nameDetail?: string;
			};

			if (userData.type === "bone") {
				mesh.material = new THREE.MeshPhysicalMaterial({
					color: 0xcdd6e0,
					transparent: true,
					opacity: 0.08,
					roughness: 0.4,
					metalness: 0.2,
					clearcoat: 0.3,
					side: THREE.DoubleSide,
					depthWrite: false,
				});
			} else if (userData.type === "muscle") {
				const meshName =
					userData.name || userData.nameDetail || mesh.name || "";
				const bodyPart = findBodyPart(meshName);
				const level = bodyPart ? fatigueLookup[bodyPart] : undefined;

				let mat: THREE.MeshPhysicalMaterial;
				let baseEmissiveIntensity: number;
				let baseOpacity: number;

				if (level !== undefined) {
					const theme = getFatigueTheme(level);
					baseEmissiveIntensity = 0.15;
					baseOpacity = 0.72;
					mat = new THREE.MeshPhysicalMaterial({
						color: theme.base,
						emissive: theme.emissive,
						emissiveIntensity: baseEmissiveIntensity,
						transparent: true,
						opacity: baseOpacity,
						roughness: 0.25,
						metalness: 0.3,
						clearcoat: 1.0,
						clearcoatRoughness: 0.1,
						side: THREE.DoubleSide,
					});
				} else {
					baseEmissiveIntensity = 0.05;
					baseOpacity = 0.25;
					mat = new THREE.MeshPhysicalMaterial({
						color: 0x1e2a3a,
						emissive: new THREE.Color(0x2a3f5f),
						emissiveIntensity: baseEmissiveIntensity,
						transparent: true,
						opacity: baseOpacity,
						roughness: 0.3,
						metalness: 0.4,
						clearcoat: 0.6,
						clearcoatRoughness: 0.2,
						side: THREE.DoubleSide,
					});
				}

				mesh.material = mat;
				muscleMeshes.push({
					mesh,
					material: mat,
					baseEmissiveIntensity,
					baseOpacity,
				});
			} else {
				mesh.material = new THREE.MeshPhysicalMaterial({
					color: 0x151c28,
					transparent: true,
					opacity: 0.06,
					roughness: 0.5,
					metalness: 0.1,
					side: THREE.DoubleSide,
					depthWrite: false,
				});
			}
		});

		muscleMeshesRef.current = muscleMeshes;
	}, [scene, fatigueLookup]);

	/* ── Pulsating hover glow — only iterates cached meshes ── */
	useFrame(({ clock }) => {
		const hid = hoveredRef.current;
		const meshes = muscleMeshesRef.current;
		if (meshes.length === 0) return;

		const t = clock.getElapsedTime();
		// Slow sine pulse: period ~2s
		const pulse = 0.35 + Math.sin(t * Math.PI) * 0.2;
		const opacityPulse = 0.85 + Math.sin(t * Math.PI) * 0.1;

		for (let i = 0; i < meshes.length; i++) {
			const { mesh, material, baseEmissiveIntensity, baseOpacity } = meshes[i];
			if (mesh.uuid === hid) {
				material.emissiveIntensity = pulse;
				material.opacity = opacityPulse;
			} else {
				material.emissiveIntensity = baseEmissiveIntensity;
				material.opacity = baseOpacity;
			}
		}
	});

	// Cursor style — deferred to avoid React compiler 'value cannot be modified' error
	useEffect(() => {
		const el = gl.domElement;
		const cursor = hovered ? "pointer" : "grab";
		requestAnimationFrame(() => {
			el.style.cursor = cursor;
		});
	}, [hovered, gl]);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const handlePointerOver = useCallback((e: any) => {
		e.stopPropagation();
		const mesh = e.object as THREE.Mesh;
		const ud = mesh.userData as { type?: string };
		if (ud.type === "muscle") setHovered(mesh.uuid);
	}, []);

	const handlePointerOut = useCallback(() => setHovered(null), []);


	const handleClick = useCallback(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(e: any) => {
			e.stopPropagation();
			const mesh = e.object as THREE.Mesh;
			const ud = mesh.userData as {
				type?: string;
				name?: string;
				nameDetail?: string;
			};
			if (ud.type === "muscle") {
				const name = ud.name || ud.nameDetail || mesh.name || "Unknown";
				const bodyPart = findBodyPart(name);
				onMeshClick(name, bodyPart);
			}
		},
		[onMeshClick],
	);

	return (
		<group ref={modelRef} position={[0, -0.3, 0]}>
			<primitive
				object={scene}
				scale={1}
				onPointerOver={handlePointerOver}
				onPointerOut={handlePointerOut}
				onClick={handleClick}
			/>
		</group>
	);
}

/* ═══════════════════════════════════════════════════
   ERROR FALLBACK
   ═══════════════════════════════════════════════════ */
function ErrorFallback() {
	return (
		<div className="flex items-center justify-center h-full">
			<div className="text-center px-6">
				<div className="text-4xl mb-4">⚠️</div>
				<p className="text-sm font-medium" style={{ color: "#e2e8f0" }}>
					3D viewer failed to load
				</p>
				<p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.4)" }}>
					Your browser may not support WebGL, or the model failed to load.
				</p>
				<button
					onClick={() => window.location.reload()}
					className="mt-4 px-4 py-2 rounded-lg text-xs font-medium"
					style={{
						background: "rgba(99,102,241,0.2)",
						color: "#a5b4fc",
						border: "1px solid rgba(99,102,241,0.3)",
					}}
				>
					Reload page
				</button>
			</div>
		</div>
	);
}

/* ═══════════════════════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════════════════════ */
export default function Body3DViewer({
	fatigueData,
}: {
	fatigueData: MuscleFatigue[];
}) {
	const [selectedMuscle, setSelectedMuscle] = useState<{
		name: string;
		bodyPart: string | null;
	} | null>(null);
	const [hasError, setHasError] = useState(false);

	const handleMeshClick = useCallback(
		(name: string, bodyPart: string | null) => {
			setSelectedMuscle((prev) =>
				prev?.name === name ? null : { name, bodyPart },
			);
		},
		[],
	);

	const selectedFatigue = useMemo(() => {
		if (!selectedMuscle?.bodyPart) return null;
		return (
			fatigueData.find((f) => f.bodyPart === selectedMuscle.bodyPart) ?? null
		);
	}, [selectedMuscle, fatigueData]);

	if (hasError) {
		return (
			<div
				className="w-full overflow-hidden relative"
				style={{
					height: "calc(100vh - 160px)",
					minHeight: "500px",
					borderRadius: "16px",
					border: "1px solid rgba(255,255,255,0.08)",
					background:
						"linear-gradient(135deg, rgba(13,17,23,0.95) 0%, rgba(22,27,45,0.95) 100%)",
				}}
			>
				<ErrorFallback />
			</div>
		);
	}

	return (
		<div className="flex flex-col lg:flex-row gap-6 w-full items-start">
			{/* 3D Canvas — fills most viewport */}
			<div className="flex-1 w-full">
				<div
					className="overflow-hidden relative"
					style={{
						height: "calc(100vh - 160px)",
						minHeight: "500px",
						borderRadius: "16px",
						border: "1px solid rgba(255,255,255,0.08)",
						background:
							"linear-gradient(135deg, rgba(13,17,23,0.95) 0%, rgba(22,27,45,0.95) 100%)",
						backdropFilter: "blur(20px)",
						boxShadow:
							"0 0 80px rgba(99,102,241,0.06), inset 0 1px 0 rgba(255,255,255,0.04)",
					}}
				>
					<Canvas
						camera={{ position: [0, 0.2, 3.5], fov: 45 }}
						gl={{
							antialias: true,
							alpha: true,
							toneMapping: THREE.ACESFilmicToneMapping,
							toneMappingExposure: 1.2,
							powerPreference: "high-performance",
						}}
						style={{ background: "transparent" }}
						dpr={[1, 1.5]}
						onCreated={({ gl: renderer }) => {
							renderer.outputColorSpace = THREE.SRGBColorSpace;
						}}
						fallback={<ErrorFallback />}
						onError={() => setHasError(true)}
					>
						<color attach="background" args={["#080c14"]} />
						<fog attach="fog" args={["#080c14", 8, 20]} />

						{/* Lighting rig — soft, dramatic */}
						<ambientLight intensity={0.3} />
						<directionalLight
							position={[5, 8, 5]}
							intensity={0.7}
							color="#e2e8f0"
						/>
						<directionalLight
							position={[-5, 3, -5]}
							intensity={0.25}
							color="#94a3b8"
						/>
						{/* Rim lights for silhouette pop */}
						<pointLight
							position={[-3, 2, -2]}
							intensity={0.4}
							color="#6366f1"
							distance={10}
							decay={2}
						/>
						<pointLight
							position={[3, -1, -3]}
							intensity={0.3}
							color="#0ea5e9"
							distance={10}
							decay={2}
						/>
						{/* Subtle top fill */}
						<pointLight
							position={[0, 6, 0]}
							intensity={0.15}
							color="#a78bfa"
							distance={12}
							decay={2}
						/>

						<Suspense fallback={<Loader />}>
							<BodyModel
								fatigueData={fatigueData}
								onMeshClick={handleMeshClick}
							/>
						</Suspense>

						<OrbitControls
							enableDamping
							dampingFactor={0.04}
							minDistance={1.8}
							maxDistance={8}
							enablePan={false}
							target={[0, 0.2, 0]}
							maxPolarAngle={Math.PI * 0.85}
							minPolarAngle={Math.PI * 0.1}
							rotateSpeed={0.6}
						/>
					</Canvas>

					{/* Controls hint — bottom glass pill */}
					<div
						className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs px-4 py-2 rounded-full"
						style={{
							background: "rgba(255,255,255,0.04)",
							color: "rgba(255,255,255,0.35)",
							backdropFilter: "blur(12px)",
							border: "1px solid rgba(255,255,255,0.06)",
							letterSpacing: "0.03em",
						}}
					>
						Drag to rotate · Scroll to zoom · Click muscle for details
					</div>

					{/* Legend — top-right glass panel */}
					<div
						className="absolute top-4 right-4 flex flex-col gap-2 text-xs px-4 py-3 rounded-xl"
						style={{
							background: "rgba(255,255,255,0.04)",
							color: "rgba(255,255,255,0.6)",
							backdropFilter: "blur(16px)",
							border: "1px solid rgba(255,255,255,0.06)",
						}}
					>
						<span className="font-semibold text-white/80 text-[11px] uppercase tracking-widest mb-0.5">
							Fatigue
						</span>
						{[
							{ label: "Low", color: "#00ffa3" },
							{ label: "Moderate", color: "#ffb800" },
							{ label: "High", color: "#ff3d5a" },
						].map(({ label, color }) => (
							<span key={label} className="flex items-center gap-2.5">
								<span
									className="w-2 h-2 rounded-full"
									style={{
										background: color,
										boxShadow: `0 0 6px ${color}66`,
									}}
								/>
								<span style={{ color: `${color}cc` }}>{label}</span>
							</span>
						))}
					</div>
				</div>
			</div>

			{/* Detail panel */}
			<div className="w-full lg:w-80 lg:sticky lg:top-6">
				<div
					className="p-5 space-y-4 rounded-xl"
					style={{
						background: "rgba(255,255,255,0.03)",
						backdropFilter: "blur(20px)",
						border: "1px solid rgba(255,255,255,0.06)",
						boxShadow: "0 0 40px rgba(0,0,0,0.3)",
					}}
				>
					{selectedMuscle && selectedFatigue ? (
						<>
							<div className="flex items-start justify-between gap-3">
								<div>
									<h3
										className="text-lg font-bold"
										style={{ color: "#e2e8f0" }}
									>
										{selectedMuscle.name}
									</h3>
									<p
										className="text-xs mt-0.5"
										style={{ color: "rgba(255,255,255,0.35)" }}
									>
										3D Anatomy View
									</p>
								</div>
								<span
									className="px-2.5 py-1 rounded-full text-xs font-bold"
									style={{
										color: getFatigueTheme(
											selectedFatigue.level,
										).base.getStyle(),
										background: `${getFatigueTheme(selectedFatigue.level).base.getStyle()}18`,
										boxShadow: `0 0 12px ${getFatigueTheme(selectedFatigue.level).base.getStyle()}22`,
									}}
								>
									{selectedFatigue.level}%
								</span>
							</div>

							<div className="flex items-center gap-5">
								<div className="relative w-20 h-20 flex-shrink-0">
									<svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
										<circle
											cx="18"
											cy="18"
											r="14"
											fill="none"
											stroke="rgba(255,255,255,0.06)"
											strokeWidth="2.5"
										/>
										<circle
											cx="18"
											cy="18"
											r="14"
											fill="none"
											stroke={getFatigueTheme(
												selectedFatigue.level,
											).base.getStyle()}
											strokeWidth="2.5"
											strokeDasharray={`${(selectedFatigue.level / 100) * 88} 88`}
											strokeLinecap="round"
											style={{
												filter: `drop-shadow(0 0 4px ${getFatigueTheme(selectedFatigue.level).base.getStyle()}88)`,
											}}
										/>
									</svg>
									<span
										className="absolute inset-0 flex items-center justify-center text-lg font-bold"
										style={{
											color: getFatigueTheme(
												selectedFatigue.level,
											).base.getStyle(),
										}}
									>
										{selectedFatigue.level}%
									</span>
								</div>
								<div className="space-y-1">
									<div
										className="text-sm font-medium"
										style={{ color: "#e2e8f0" }}
									>
										{selectedFatigue.muscle}
									</div>
									<div
										className="text-xs leading-relaxed"
										style={{ color: "rgba(255,255,255,0.4)" }}
									>
										{selectedFatigue.status === "high"
											? "Critical fatigue — rest recommended"
											: selectedFatigue.status === "moderate"
												? "Moderate fatigue — limit intensity"
												: "Fresh — ready for high intensity"}
									</div>
								</div>
							</div>
						</>
					) : (
						<div className="text-center py-8">
							<div className="text-3xl mb-3 opacity-50">🦴</div>
							<p
								className="text-sm font-medium"
								style={{ color: "rgba(255,255,255,0.6)" }}
							>
								Select a muscle
							</p>
							<p
								className="text-xs mt-1"
								style={{ color: "rgba(255,255,255,0.25)" }}
							>
								Click any highlighted muscle on the 3D model
							</p>
						</div>
					)}

					<hr style={{ borderColor: "rgba(255,255,255,0.06)" }} />

					{/* Muscle fatigue list */}
					<div className="space-y-1.5">
						<h4
							className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-2"
							style={{ color: "rgba(255,255,255,0.3)" }}
						>
							All Muscle Groups
						</h4>
						{[...fatigueData]
							.sort((a, b) => b.level - a.level)
							.map((f) => {
								const theme = getFatigueTheme(f.level);
								const colorStr = theme.base.getStyle();
								return (
									<div
										key={f.bodyPart}
										className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200"
										style={{ background: "rgba(255,255,255,0.02)" }}
									>
										<span
											className="text-xs flex-1"
											style={{ color: "rgba(255,255,255,0.6)" }}
										>
											{f.muscle}
										</span>
										<div
											className="w-14 h-1 rounded-full"
											style={{ background: "rgba(255,255,255,0.06)" }}
										>
											<div
												className="h-full rounded-full"
												style={{
													width: `${f.level}%`,
													background: colorStr,
													boxShadow: `0 0 6px ${colorStr}55`,
												}}
											/>
										</div>
										<span
											className="text-[11px] font-bold w-8 text-right"
											style={{ color: colorStr }}
										>
											{f.level}%
										</span>
									</div>
								);
							})}
					</div>
				</div>
			</div>
		</div>
	);
}

useGLTF.preload("/workout/models/body.glb", "/workout/draco/");
