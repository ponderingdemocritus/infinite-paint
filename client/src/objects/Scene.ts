import * as THREE from 'three';
import { SetupResult } from '../dojo/generated/setup';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import _ from 'lodash';
import { shortString } from 'starknet';

import { ColorRepresentation } from 'three';
import { ChunkManager, OFFSET } from './ChunkManager';
import { TileSystem } from './TileSystem';

export class Scene {
	private scene!: THREE.Scene;
	private camera!: THREE.PerspectiveCamera;
	private renderer!: THREE.WebGLRenderer;

	private hoveredMesh: THREE.Mesh | null = null;
	private originalMaterial: THREE.Material | null = null;

	private chunkManager!: ChunkManager;
	private tileSystem!: TileSystem;

	private controls!: OrbitControls;

	private raycaster: THREE.Raycaster;
	private mouse: THREE.Vector2;

	private cameraDistance = Math.sqrt(2 * 20 * 20); // Maintain the same distance
	private cameraAngle = 60 * (Math.PI / 180); // 75 degrees in radians

	private chunkSize = 10; // Size of each chunk

	private lerpFactor = 0.9;

	private dojo: SetupResult;

	private width = window.innerWidth;
	private height = window.innerHeight;

	private contextMenu!: HTMLDivElement;
	private selectedColor: ColorRepresentation = 0x00ff00; // Default green color

	constructor(dojoContext: SetupResult) {
		this.dojo = dojoContext;

		this.raycaster = new THREE.Raycaster();
		this.mouse = new THREE.Vector2();

		this.scene = new THREE.Scene();
		this.renderer = new THREE.WebGLRenderer();

		this.chunkManager = new ChunkManager(this.scene, this.dojo);
	}

	initScene() {
		this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
		const cameraHeight = Math.sin(this.cameraAngle) * this.cameraDistance;
		const cameraDepth = Math.cos(this.cameraAngle) * this.cameraDistance;
		this.camera.position.set(0, cameraHeight, -cameraDepth);
		this.camera.lookAt(0, 0, 0);
		this.camera.up.set(0, 1, 0);

		this.renderer.setSize(this.width, this.height);
		document.body.appendChild(this.renderer.domElement);

		this.setupCamera();
		this.setupControls();
		this.addLights();

		this.controls.addEventListener(
			'change',
			_.throttle(() => {
				this.chunkManager.update(this.camera.position);
			}, 100)
		);

		this.setupMouseListeners();

		this.createContextMenu();

		this.animate();

		// Load initial chunks
		this.chunkManager.update(this.camera.position);

		this.tileSystem = new TileSystem(this.dojo, this.chunkManager);
		this.tileSystem.setupTileSystem();
	}

	private setupControls() {
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.05;
		this.controls.screenSpacePanning = true;
		this.controls.minDistance = 10;
		this.controls.maxDistance = 100;
		this.controls.maxPolarAngle = Math.PI / 2.5; // Limit how low the camera can go
		this.controls.minPolarAngle = Math.PI / 4; // Limit how high the camera can go
		this.controls.enableRotate = false; // Disable rotation for RTS-like controls
	}

	private setupCamera() {
		const aspect = this.width / this.height;
		this.camera = new THREE.PerspectiveCamera(30, aspect, 0.1, 1000); // Reduced FOV from 45 to 30

		// Calculate camera position
		const distance = this.cameraDistance;
		const height = Math.sin(this.cameraAngle) * distance;
		const depth = Math.cos(this.cameraAngle) * distance;
		this.camera.position.set(0, height, depth);
		this.camera.lookAt(0, 0, 0);
	}

	public render() {
		this.renderer.render(this.scene, this.camera);
	}

	public animate() {
		requestAnimationFrame(() => this.animate());

		if (this.controls) {
			this.controls.update();

			const currentPosition = this.camera.position;
			const targetPosition = this.controls.target;
			const direction = new THREE.Vector3().subVectors(currentPosition, targetPosition).normalize();
			const distance = this.cameraDistance;
			const height = Math.sin(this.cameraAngle) * distance;
			const horizontalDistance = Math.cos(this.cameraAngle) * distance;

			const newPosition = new THREE.Vector3(
				targetPosition.x + direction.x * horizontalDistance,
				height,
				targetPosition.z + direction.z * horizontalDistance
			);

			this.camera.position.lerp(newPosition, this.lerpFactor);
			this.camera.lookAt(this.controls.target);
		}

		this.render();
	}

	private setupMouseListeners() {
		this.renderer.domElement.addEventListener('contextmenu', (event) => this.onContextMenu(event), false);
		this.renderer.domElement.addEventListener('click', (event) => this.onMouseClick(event), false);
		document.addEventListener('click', () => {
			this.contextMenu.style.display = 'none';
		});
		this.renderer.domElement.addEventListener('mousemove', (event) => this.onMouseHover(event), false);
	}

	async onMouseClick(event: MouseEvent) {
		this.mouse.x = (event.clientX / this.width) * 2 - 1;
		this.mouse.y = -(event.clientY / this.height) * 2 + 1;

		this.raycaster.setFromCamera(this.mouse, this.camera);

		const intersects = this.raycaster.intersectObjects(this.scene.children, true);

		for (let intersect of intersects) {
			if (intersect.object instanceof THREE.Mesh) {
				const chunk = intersect.object.parent as THREE.Group;
				const chunkPosition = new THREE.Vector3();
				chunk.getWorldPosition(chunkPosition);

				// Calculate local coordinates within the chunk
				const localX = Math.floor(intersect.point.x - chunkPosition.x);
				const localZ = Math.floor(intersect.point.z - chunkPosition.z);

				// Calculate chunk coordinates
				const chunkX = Math.floor(chunkPosition.x / this.chunkSize);
				const chunkZ = Math.floor(chunkPosition.z / this.chunkSize);

				// Calculate world coordinates
				const worldX = chunkX * this.chunkSize + localX + OFFSET;
				const worldZ = chunkZ * this.chunkSize + localZ + OFFSET;

				console.log(`Clicked square world coordinates: x=${worldX}, z=${worldZ}`);

				// Change the color and opacity of the clicked square
				// const material = intersect.object.material as THREE.MeshBasicMaterial;
				// material.color.setHex(this.selectedColor as number);
				// material.opacity = 0.5;

				await this.dojo.client.actions.paint({
					account: this.dojo.burnerManager.account!,
					x: worldX.toString(),
					y: worldZ.toString(),
					color: shortString.encodeShortString(this.selectedColor.toString()),
				});

				break;
			}
		}
	}

	private onMouseHover(event: MouseEvent) {
		this.mouse.x = (event.clientX / this.width) * 2 - 1;
		this.mouse.y = -(event.clientY / this.height) * 2 + 1;

		this.raycaster.setFromCamera(this.mouse, this.camera);

		const intersects = this.raycaster.intersectObjects(this.scene.children, true);

		// Reset previously hovered mesh
		if (this.hoveredMesh && this.originalMaterial) {
			this.hoveredMesh.material = this.originalMaterial;
			this.hoveredMesh = null;
			this.originalMaterial = null;
		}

		for (let intersect of intersects) {
			if (intersect.object instanceof THREE.Mesh) {
				const mesh = intersect.object as THREE.Mesh;

				// Store original material and apply hover effect
				this.hoveredMesh = mesh;
				this.originalMaterial = mesh.material as any;

				const hoverMaterial = new THREE.MeshBasicMaterial({
					color: this.selectedColor,
					opacity: 0.5,
					transparent: true,
				});
				mesh.material = hoverMaterial;

				// Add pulsing effect
				const pulseAnimation = () => {
					if (this.hoveredMesh === mesh) {
						const scale = 1 + Math.sin(Date.now() * 0.03) * 0.05; // Adjust speed and intensity here
						mesh.scale.set(scale, scale, scale);
						requestAnimationFrame(pulseAnimation);
					} else {
						mesh.scale.set(1, 1, 1);
					}
				};
				pulseAnimation();

				// Calculate and log coordinates (optional)
				const chunk = mesh.parent as THREE.Group;
				const chunkPosition = new THREE.Vector3();
				chunk.getWorldPosition(chunkPosition);

				const localX = Math.floor(intersect.point.x - chunkPosition.x);
				const localZ = Math.floor(intersect.point.z - chunkPosition.z);

				const chunkX = Math.floor(chunkPosition.x / this.chunkSize);
				const chunkZ = Math.floor(chunkPosition.z / this.chunkSize);

				const worldX = chunkX * this.chunkSize + localX + OFFSET;
				const worldZ = chunkZ * this.chunkSize + localZ + OFFSET;

				console.log(`Hovered square world coordinates: x=${worldX}, z=${worldZ}`);

				break;
			}
		}
	}

	private createContextMenu() {
		this.contextMenu = document.createElement('div');
		this.contextMenu.style.position = 'absolute';
		this.contextMenu.style.display = 'none';
		this.contextMenu.style.backgroundColor = 'white';
		this.contextMenu.style.border = '1px solid black';
		this.contextMenu.style.padding = '5px';

		const colors: ColorRepresentation[] = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];

		colors.forEach((color) => {
			const colorButton = document.createElement('button');
			colorButton.style.width = '20px';
			colorButton.style.height = '20px';
			colorButton.style.backgroundColor = `#${color.toString(16).padStart(6, '0')}`;
			colorButton.style.margin = '2px';
			colorButton.onclick = () => {
				this.selectedColor = color;
				this.contextMenu.style.display = 'none';
			};
			this.contextMenu.appendChild(colorButton);
		});

		document.body.appendChild(this.contextMenu);
	}

	private onContextMenu(event: MouseEvent) {
		event.preventDefault();
		this.contextMenu.style.display = 'block';
		this.contextMenu.style.left = `${event.clientX}px`;
		this.contextMenu.style.top = `${event.clientY}px`;
	}

	private addLights() {
		// Ambient light for overall scene brightness
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
		this.scene.add(ambientLight);

		// Directional light for some shadows and depth
		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
		directionalLight.position.set(1, 1, 1).normalize();
		this.scene.add(directionalLight);
	}

	public onWindowResize() {
		this.width = window.innerWidth;
		this.height = window.innerHeight;
		this.camera.aspect = this.width / this.height;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(this.width, this.height);
		this.render();
	}
}
