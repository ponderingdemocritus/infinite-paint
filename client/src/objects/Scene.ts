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
import { Has, HasValue, defineSystem } from '@dojoengine/recs';

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
	private selectedColor: ColorRepresentation = 0x00ff00;

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
				const chunkX = Math.floor(chunkPosition.x / this.chunkManager.chunkSize);
				const chunkZ = Math.floor(chunkPosition.z / this.chunkManager.chunkSize);

				// Calculate world coordinates
				const worldX = chunkX * this.chunkManager.chunkSize + localX + OFFSET;
				const worldZ = chunkZ * this.chunkManager.chunkSize + localZ + OFFSET;

				// Change the color and opacity of the clicked square
				// const material = intersect.object.material as THREE.MeshBasicMaterial;
				// material.color.setHex(this.selectedColor as number);
				// material.opacity = 0.5;

				this.showSpinner(event.clientX, event.clientY);

				try {
					await this.dojo.client.actions.paint({
						account: this.dojo.burnerManager.account,
						x: worldX.toString(),
						y: worldZ.toString(),
						color: shortString.encodeShortString(this.selectedColor.toString()),
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

			const colors = Array(4).fill(this.selectedColor.toString(16).padStart(6, '0').replace(/^/, '#'));
			['front', 'back', 'right', 'left', 'top', 'bottom'].forEach((face, index) => {
				const element = document.createElement('div');
				element.style.position = 'absolute';
				element.style.width = '100%';
				element.style.height = '100%';
				element.style.background = colors[index % colors.length];
				element.style.opacity = '0.8';
				element.style.border = `2px solid ${this.selectedColor.toString(16).padStart(6, '0').replace(/^/, '#')}`;
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

				const pulseAnimation = () => {
					if (this.hoveredMesh === mesh) {
						const scale = 1 + Math.sin(Date.now() * 0.03) * 0.05;
						mesh.scale.set(scale, scale, scale);
						requestAnimationFrame(pulseAnimation);
					} else {
						mesh.scale.set(1, 1, 1);
					}
				};
				pulseAnimation();

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
