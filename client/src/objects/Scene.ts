import * as THREE from 'three';
import { SetupResult } from '../dojo/generated/setup';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import _ from 'lodash';
import { shortString } from 'starknet';
import { defineComponentSystem, getComponentValue } from '@dojoengine/recs';
import { getEntityIdFromKeys } from '@dojoengine/utils';
import { ColorRepresentation } from 'three';

// offset as negative numbers
const OFFSET = 5000;

export class Scene {
	private scene!: THREE.Scene;
	private camera!: THREE.PerspectiveCamera;
	private renderer!: THREE.WebGLRenderer;

	private controls!: OrbitControls;

	private raycaster: THREE.Raycaster;
	private mouse: THREE.Vector2;
	private squares: THREE.Mesh[][] = [];

	private cameraDistance = Math.sqrt(2 * 20 * 20); // Maintain the same distance
	private cameraAngle = 60 * (Math.PI / 180); // 75 degrees in radians

	private chunkSize = 10; // Size of each chunk
	private loadedChunks: Map<string, THREE.Group> = new Map();
	private chunkLoadDistance = 2;

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

		this.createContextMenu();
		this.setupTileSystem();
	}

	initScene() {
		this.scene = new THREE.Scene();
		this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
		const cameraHeight = Math.sin(this.cameraAngle) * this.cameraDistance;
		const cameraDepth = Math.cos(this.cameraAngle) * this.cameraDistance;
		this.camera.position.set(0, cameraHeight, -cameraDepth);
		this.camera.lookAt(0, 0, 0);
		this.camera.up.set(0, 1, 0);

		this.renderer = new THREE.WebGLRenderer();

		this.renderer.setSize(this.width, this.height);
		document.body.appendChild(this.renderer.domElement);

		this.setupCamera();
		this.setupControls();
		this.addLights();

		this.controls.addEventListener(
			'change',
			_.throttle(() => {
				this.loadChunksAroundCamera();
			}, 100)
		);

		this.animate();

		this.setupMouseListeners();
	}

	private setupTileSystem() {
		defineComponentSystem(this.dojo.world, this.dojo.clientComponents.Tile, (update) => {
			const { value } = update;

			this.updateTile(value[0]?.x || 0, value[0]?.y || 0, value[0]?.color.toString() || '');
		});
	}

	private updateTile(x: number, y: number, value: string) {
		const chunkX = Math.floor((x - OFFSET) / this.chunkSize);
		const chunkZ = Math.floor((y - OFFSET) / this.chunkSize);
		const chunkKey = `${chunkX},${chunkZ}`;

		if (this.loadedChunks.has(chunkKey)) {
			const chunk = this.loadedChunks.get(chunkKey)!;
			let localX = (x - OFFSET) % this.chunkSize;
			let localZ = (y - OFFSET) % this.chunkSize;

			// Ensure localX and localZ are always positive
			if (localX < 0) localX += this.chunkSize;
			if (localZ < 0) localZ += this.chunkSize;

			// Swap X and Z when calculating the index
			const tileIndex = localZ + localX * this.chunkSize;

			console.log(`World coordinates: (${x}, ${y})`);
			console.log(`Chunk coordinates: (${chunkX}, ${chunkZ})`);
			console.log(`Local coordinates: (${localX}, ${localZ})`);
			console.log(`Updating tile at index ${tileIndex}`);

			const tile = chunk.children[tileIndex] as THREE.Mesh;
			if (tile instanceof THREE.Mesh) {
				const material = tile.material as THREE.MeshBasicMaterial;
				material.color.setHex(parseInt(shortString.decodeShortString(value)));
				material.opacity = 0.5;
			} else {
				console.log(`Tile not found at index ${tileIndex}`);
			}
		} else {
			console.log(`Chunk not loaded for tile at (${x}, ${y})`);
		}
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

	private createChunk(chunkX: number, chunkZ: number): THREE.Group {
		const chunk = new THREE.Group();
		const geometry = new THREE.PlaneGeometry(1, 1);
		const material = new THREE.MeshBasicMaterial({
			color: 'white',
			side: THREE.DoubleSide,
			transparent: true,
			opacity: 0,
		});

		// Create squares
		for (let x = 0; x < this.chunkSize; x++) {
			for (let z = 0; z < this.chunkSize; z++) {
				const square = new THREE.Mesh(geometry, material.clone());
				const worldX = chunkX * this.chunkSize + x + OFFSET;
				const worldZ = chunkZ * this.chunkSize + z + OFFSET;
				square.position.set(x + 0.5, 0, z + 0.5);
				square.rotation.x = -Math.PI / 2;

				const tileEntityId = getEntityIdFromKeys([BigInt(worldX), BigInt(worldZ)]);
				const tileComponent = getComponentValue(this.dojo.clientComponents.Tile, tileEntityId);

				if (tileComponent && tileComponent.color) {
					console.log(`Tile at (${worldX}, ${worldZ}) has color: ${tileComponent.color}`);

					console.log(tileComponent.color.toString());
					square.material.color.setHex(parseInt(shortString.decodeShortString(tileComponent.color.toString())));
					square.material.opacity = 0.5;
				}

				chunk.add(square);
				this.squares[worldX] = this.squares[worldX] || [];
				this.squares[worldX][worldZ] = square;
			}
		}

		const greenLineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 }); // Green color

		for (let i = 0; i <= this.chunkSize; i++) {
			const lineGeometry1 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(i, 0, 0), new THREE.Vector3(i, 0, this.chunkSize)]);
			const lineGeometry2 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, i), new THREE.Vector3(this.chunkSize, 0, i)]);

			chunk.add(new THREE.Line(lineGeometry1, greenLineMaterial));
			chunk.add(new THREE.Line(lineGeometry2, greenLineMaterial));
		}

		chunk.position.set(chunkX * this.chunkSize, 0, chunkZ * this.chunkSize);

		return chunk;
	}

	private loadChunksAroundCamera() {
		const cameraChunkX = Math.floor(this.camera.position.x / this.chunkSize);
		const cameraChunkZ = Math.floor(this.camera.position.z / this.chunkSize);

		for (let dx = -this.chunkLoadDistance; dx <= this.chunkLoadDistance; dx++) {
			for (let dz = -this.chunkLoadDistance; dz <= this.chunkLoadDistance; dz++) {
				const chunkX = cameraChunkX + dx;
				const chunkZ = cameraChunkZ + dz;
				const chunkKey = `${chunkX},${chunkZ}`;

				if (!this.loadedChunks.has(chunkKey)) {
					const chunk = this.createChunk(chunkX, chunkZ);
					this.scene.add(chunk);
					this.loadedChunks.set(chunkKey, chunk);
				}
			}
		}

		// Optionally, unload distant chunks
		this.unloadDistantChunks(cameraChunkX, cameraChunkZ);
	}

	private unloadDistantChunks(cameraChunkX: number, cameraChunkZ: number) {
		for (const [chunkKey, chunk] of this.loadedChunks.entries()) {
			const [chunkX, chunkZ] = chunkKey.split(',').map(Number);
			const distance = Math.max(Math.abs(chunkX - cameraChunkX), Math.abs(chunkZ - cameraChunkZ));

			if (distance > this.chunkLoadDistance + 1) {
				this.scene.remove(chunk);
				this.loadedChunks.delete(chunkKey);
			}
		}
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

	private addLights() {
		// Ambient light for overall scene brightness
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
		this.scene.add(ambientLight);

		// Directional light for some shadows and depth
		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
		directionalLight.position.set(1, 1, 1).normalize();
		this.scene.add(directionalLight);
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

	public onWindowResize() {
		this.width = window.innerWidth;
		this.height = window.innerHeight;
		this.camera.aspect = this.width / this.height;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(this.width, this.height);
		this.render(); // Add this line to ensure the scene is re-rendered on resize
	}
}
