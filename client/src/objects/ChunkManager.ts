import { getEntityIdFromKeys } from '@dojoengine/utils';
import { SetupResult } from '../dojo/generated/setup';
import * as THREE from 'three';
import { Subscription } from '@dojoengine/torii-client';
import { getSyncEntities } from '@dojoengine/state';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

export const OFFSET = 5000;

export class ChunkManager {
	private coordinatesSubject: Subject<[number, number][]> = new Subject();

	private maxWorldSize = 1000;

	loadedChunks: Map<string, THREE.Group> = new Map();
	chunkSize = 20;
	chunkLoadDistance = 1;

	private squares: THREE.Mesh[][] = [];

	subscription: Subscription | null = null;

	coordinates: [number, number][];

	private lastUpdatePosition: THREE.Vector3 = new THREE.Vector3();
	private updateThreshold: number = 8; // Distance to move before updating
	private chunkUpdateInterval: number = 100; // Milliseconds between chunk updates
	private lastChunkUpdateTime: number = 0;

	constructor(private scene: THREE.Scene, private dojo: SetupResult) {
		this.initializeSubscription();
	}

	public update(cameraPosition: THREE.Vector3) {
		const currentTime = performance.now();
		if (
			currentTime - this.lastChunkUpdateTime > this.chunkUpdateInterval &&
			cameraPosition.distanceTo(this.lastUpdatePosition) > this.updateThreshold
		) {
			this.loadChunksAroundCamera(cameraPosition);
			this.lastUpdatePosition.copy(cameraPosition);
			this.lastChunkUpdateTime = currentTime;
		}
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

				chunk.add(square);
				this.squares[worldX] = this.squares[worldX] || [];
				this.squares[worldX][worldZ] = square;
			}
		}

		const greenLineMaterial = new THREE.LineBasicMaterial({ color: 'red' }); // Green color

		for (let i = 0; i <= this.chunkSize; i++) {
			const lineGeometry1 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(i, 0, 0), new THREE.Vector3(i, 0, this.chunkSize)]);
			const lineGeometry2 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, i), new THREE.Vector3(this.chunkSize, 0, i)]);

			chunk.add(new THREE.Line(lineGeometry1, greenLineMaterial));
			chunk.add(new THREE.Line(lineGeometry2, greenLineMaterial));
		}

		chunk.position.set(chunkX * this.chunkSize, 0, chunkZ * this.chunkSize);

		return chunk;
	}

	private initializeSubscription() {
		this.coordinatesSubject
			.pipe(
				debounceTime(2000) // Adjust this value as needed
			)
			.subscribe((coordinates) => {
				this.updateSubscription(coordinates);
			});
	}

	private async updateSubscription(coordinates: [number, number][]) {
		if (this.subscription) this.subscription.cancel();

		const sub = await getSyncEntities(this.dojo.toriiClient, this.dojo.contractComponents as any, [
			{
				HashedKeys: coordinates.map((coord) => getEntityIdFromKeys([BigInt(coord[0]), BigInt(coord[1])]).toString()),
			},
		]);

		this.subscription = sub;
	}

	private loadChunksAroundCamera(cameraPosition: THREE.Vector3) {
		const cameraChunkX = Math.floor(cameraPosition.x / this.chunkSize);
		const cameraChunkZ = Math.floor(cameraPosition.z / this.chunkSize);

		// Clamp the camera chunk coordinates to stay within the max world size
		const clampedCameraChunkX = Math.max(0, Math.min(cameraChunkX, this.maxWorldSize / this.chunkSize - 1));
		const clampedCameraChunkZ = Math.max(0, Math.min(cameraChunkZ, this.maxWorldSize / this.chunkSize - 1));

		this.updateCoordinates(clampedCameraChunkX, clampedCameraChunkZ);
		this.loadUnloadChunks(clampedCameraChunkX, clampedCameraChunkZ);
		this.coordinatesSubject.next(this.coordinates);
	}

	private updateCoordinates(cameraChunkX: number, cameraChunkZ: number) {
		this.coordinates = [];
		for (let dx = -this.chunkLoadDistance; dx <= this.chunkLoadDistance; dx++) {
			for (let dz = -this.chunkLoadDistance; dz <= this.chunkLoadDistance; dz++) {
				const chunkX = cameraChunkX + dx;
				const chunkZ = cameraChunkZ + dz;
				this.addChunkCoordinates(chunkX, chunkZ);
			}
		}
	}

	private addChunkCoordinates(chunkX: number, chunkZ: number) {
		for (let x = 0; x < this.chunkSize; x++) {
			for (let z = 0; z < this.chunkSize; z++) {
				const worldX = chunkX * this.chunkSize + x + OFFSET;
				const worldZ = chunkZ * this.chunkSize + z + OFFSET;
				this.coordinates.push([worldX, worldZ]);
			}
		}
	}

	public get worldSize(): number {
		return this.maxWorldSize;
	}

	private loadUnloadChunks(cameraChunkX: number, cameraChunkZ: number) {
		for (let dx = -this.chunkLoadDistance; dx <= this.chunkLoadDistance; dx++) {
			for (let dz = -this.chunkLoadDistance; dz <= this.chunkLoadDistance; dz++) {
				const chunkX = cameraChunkX + dx;
				const chunkZ = cameraChunkZ + dz;

				// Check if the chunk is within the max world size
				if (chunkX >= 0 && chunkX < this.maxWorldSize / this.chunkSize && chunkZ >= 0 && chunkZ < this.maxWorldSize / this.chunkSize) {
					const chunkKey = `${chunkX},${chunkZ}`;

					if (!this.loadedChunks.has(chunkKey)) {
						const chunk = this.createChunk(chunkX, chunkZ);
						this.scene.add(chunk);
						this.loadedChunks.set(chunkKey, chunk);
					}
				}
			}
		}

		// Unload distant chunks
		for (const [chunkKey, chunk] of this.loadedChunks.entries()) {
			const [chunkX, chunkZ] = chunkKey.split(',').map(Number);
			const distance = Math.max(Math.abs(chunkX - cameraChunkX), Math.abs(chunkZ - cameraChunkZ));

			if (distance > this.chunkLoadDistance + 1) {
				this.scene.remove(chunk);
				this.loadedChunks.delete(chunkKey);
			}
		}
	}
}
