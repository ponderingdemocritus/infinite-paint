import * as THREE from 'three';
import { SetupResult } from '../dojo/generated/setup';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import _ from 'lodash';
import { num, shortString } from 'starknet';

import { ColorRepresentation } from 'three';
import { ChunkManager, OFFSET } from './ChunkManager';
import { TileSystem } from './TileSystem';
import { getSyncEntities } from '@dojoengine/state';
import { getEntityIdFromKeys } from '@dojoengine/utils';
import { Has, HasValue, defineComponentSystem, defineSystem } from '@dojoengine/recs';

export class Scene {
	private scene!: THREE.Scene;
	private camera!: THREE.PerspectiveCamera;
	private renderer!: THREE.WebGLRenderer;

	private hoveredMesh: THREE.Mesh | null = null;
	private originalMaterial: THREE.Material | null = null;

	private chunkManager!: ChunkManager;
	private tileSystem!: TileSystem;

	private controls!: OrbitControls;

	private spinner: HTMLDivElement | null = null;

	private raycaster: THREE.Raycaster;
	private mouse: THREE.Vector2;
	private minCameraDistance = Math.sqrt(2 * 20 * 20);
	private maxCameraDistance = Math.sqrt(2 * 40 * 20);
	private cameraDistance = this.minCameraDistance;
	private cameraAngle = 90 * (Math.PI / 180);

	private dojo: SetupResult;

	private width = window.innerWidth;
	private height = window.innerHeight;

	private contextMenu!: HTMLDivElement;
	private selectedFaction: number = 1;

	constructor(dojoContext: SetupResult) {
		this.dojo = dojoContext;

		this.raycaster = new THREE.Raycaster();
		this.mouse = new THREE.Vector2();

		this.scene = new THREE.Scene();
		this.renderer = new THREE.WebGLRenderer();

		this.chunkManager = new ChunkManager(this.scene, this.dojo);
	}

	initScene() {
		this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
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

		// this.createContextMenu();

		this.animate();

		// Load initial chunks
		this.chunkManager.update(this.camera.position);

		this.tileSystem = new TileSystem(this.dojo, this.chunkManager);
		this.tileSystem.setupTileSystem();

		this.setupPlayerSystem();
	}

	private setupControls() {
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.05;
		this.controls.screenSpacePanning = true;
		this.controls.enableZoom = true; // Enable zooming
		this.controls.enableRotate = false;
		this.controls.enablePan = true;
		this.controls.minDistance = this.minCameraDistance;
		this.controls.maxDistance = this.maxCameraDistance;
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
		}

		this.render();
	}

	private setupMouseListeners() {
		this.renderer.domElement.addEventListener('contextmenu', (event) => this.onContextMenu(event), false);
		this.renderer.domElement.addEventListener('click', (event) => this.onMouseClick(event), false);
		document.addEventListener('click', () => {});
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
				const chunkX = Math.floor(chunkPosition.x / this.chunkManager.chunkSize);
				const chunkZ = Math.floor(chunkPosition.z / this.chunkManager.chunkSize);

				// Calculate world coordinates
				const worldX = chunkX * this.chunkManager.chunkSize + localX + OFFSET;
				const worldZ = chunkZ * this.chunkManager.chunkSize + localZ + OFFSET;

				this.showSpinner(event.clientX, event.clientY);

				try {
					await this.dojo.client.actions.paint({
						account: this.dojo.burnerManager.account,
						x: worldX.toString(),
						y: worldZ.toString(),
					});

					await new Promise<void>((resolve) => {
						defineSystem(
							this.dojo.world,
							[Has(this.dojo.contractComponents.Tile), HasValue(this.dojo.contractComponents.Tile, { x: worldX, y: worldZ })],
							() => {
								console.log('Tile updated');
								resolve();
							}
						);
					});
				} finally {
					// Hide spinner
					this.hideSpinner();
				}
				break;
			}
		}
	}

	private showSpinner(x: number, y: number) {
		if (!this.spinner) {
			this.spinner = document.createElement('div');
			this.spinner.style.position = 'absolute';
			this.spinner.style.width = '40px';
			this.spinner.style.height = '40px';
			this.spinner.style.perspective = '120px';
			document.body.appendChild(this.spinner);

			const cube = document.createElement('div');
			cube.style.width = '100%';
			cube.style.height = '100%';
			cube.style.position = 'relative';
			cube.style.transformStyle = 'preserve-3d';
			cube.style.animation = 'spin 1.5s linear infinite';
			this.spinner.appendChild(cube);

			const images = ['/textures/paper.png', '/textures/rock.png', '/textures/scissors.png'];
			['front', 'back', 'right', 'left', 'top', 'bottom'].forEach((face, index) => {
				const element = document.createElement('div');
				element.style.position = 'absolute';
				element.style.width = '100%';
				element.style.height = '100%';
				element.style.backgroundImage = `url(${images[index % 3]})`;
				element.style.backgroundSize = 'cover';
				element.style.opacity = '1';
				element.style.border = '2px solid #000';
				element.style.transform = this.getFaceTransform(face);
				cube.appendChild(element);
			});

			const style = document.createElement('style');
			style.textContent = `
				@keyframes spin {
					0% { transform: rotateX(0deg) rotateY(0deg); }
					100% { transform: rotateX(360deg) rotateY(360deg); }
				}
			`;
			document.head.appendChild(style);
		}

		this.spinner.style.display = 'block';
		this.spinner.style.left = `${x - 20}px`;
		this.spinner.style.top = `${y - 20}px`;
	}

	private getFaceTransform(face: string): string {
		switch (face) {
			case 'front':
				return 'rotateY(0deg) translateZ(20px)';
			case 'back':
				return 'rotateY(180deg) translateZ(20px)';
			case 'right':
				return 'rotateY(90deg) translateZ(20px)';
			case 'left':
				return 'rotateY(-90deg) translateZ(20px)';
			case 'top':
				return 'rotateX(90deg) translateZ(20px)';
			case 'bottom':
				return 'rotateX(-90deg) translateZ(20px)';
			default:
				return '';
		}
	}
	private hideSpinner() {
		if (this.spinner) {
			this.spinner.style.display = 'none';
		}
	}

	private onMouseHover(event: MouseEvent) {
		this.mouse.x = (event.clientX / this.width) * 2 - 1;
		this.mouse.y = -(event.clientY / this.height) * 2 + 1;

		this.raycaster.setFromCamera(this.mouse, this.camera);

		const intersects = this.raycaster.intersectObjects(this.scene.children, true);

		let hoveredMesh: THREE.Mesh | null = null;

		for (let intersect of intersects) {
			if (intersect.object instanceof THREE.Mesh) {
				hoveredMesh = intersect.object as THREE.Mesh;
				break;
			}
		}

		if (hoveredMesh !== this.hoveredMesh) {
			if (this.hoveredMesh && this.originalMaterial) {
				this.hoveredMesh.material = this.originalMaterial;
			}

			if (hoveredMesh) {
				this.hoveredMesh = hoveredMesh;
				this.originalMaterial = hoveredMesh.material as THREE.Material;

				const hoverTexture = new THREE.TextureLoader().load(this.getSelectedTexture(this.selectedFaction));
				const hoverMaterial = new THREE.MeshBasicMaterial({
					map: hoverTexture,
					transparent: true,
					opacity: 0.7,
				});
				hoveredMesh.material = hoverMaterial;
			} else {
				this.hoveredMesh = null;
				this.originalMaterial = null;
			}
		}
	}

	setupPlayerSystem() {
		defineComponentSystem(this.dojo.world, this.dojo.clientComponents.Player, (update) => {
			const { value } = update;

			this.selectedFaction = parseInt(value[0].faction.toString());
		});
	}

	private getSelectedTexture(state: number): string {
		switch (this.selectedFaction) {
			case 1:
				return '/textures/rock.png';
			case 2:
				return '/textures/paper.png';
			case 3:
				return '/textures/scissors.png';
			default:
				return '/textures/paper.png';
		}
	}
	// private createContextMenu() {
	// 	this.contextMenu = document.createElement('div');
	// 	this.contextMenu.style.position = 'absolute';
	// 	this.contextMenu.style.display = 'none';
	// 	this.contextMenu.style.backgroundColor = 'white';
	// 	this.contextMenu.style.border = '1px solid black';
	// 	this.contextMenu.style.padding = '5px';

	// 	const images = [
	// 		{ src: '/textures/rock.png', color: 1 },
	// 		{ src: '/textures/paper.png', color: 2 },
	// 		{ src: '/textures/scissors.png', color: 3 },
	// 	];

	// 	images.forEach(({ src, color }) => {
	// 		const imageButton = document.createElement('img');
	// 		imageButton.src = src;
	// 		imageButton.style.width = '30px';
	// 		imageButton.style.height = '30px';
	// 		imageButton.style.margin = '2px';
	// 		imageButton.style.cursor = 'pointer';
	// 		imageButton.onclick = () => {
	// 			console.log('Selected color:', color);
	// 			this.selectedFaction = color;
	// 			this.contextMenu.style.display = 'none';
	// 		};
	// 		this.contextMenu.appendChild(imageButton);
	// 	});

	// 	document.body.appendChild(this.contextMenu);
	// }

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
