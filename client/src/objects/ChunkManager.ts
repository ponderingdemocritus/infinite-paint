import { getEntityIdFromKeys } from '@dojoengine/utils';
import { SetupResult } from '../dojo/generated/setup';
import * as THREE from 'three';
import { getComponentValue } from '@dojoengine/recs';
import { shortString } from 'starknet';
import { Subscription } from '@dojoengine/torii-client';
import { getSyncEntities } from '@dojoengine/state';

export const OFFSET = 5000;

export class ChunkManager {
	loadedChunks: Map<string, THREE.Group> = new Map();
	chunkSize = 10;
	chunkLoadDistance = 2;

	private squares: THREE.Mesh[][] = [];

	subscription: Subscription | null = null;

	coordinates: string[];

	constructor(private scene: THREE.Scene, private dojo: SetupResult) {}

	public update(cameraPosition: THREE.Vector3) {
		this.loadChunksAroundCamera(cameraPosition);
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

		const coordinates = [];

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

				coordinates.push([worldX, worldZ]);
			}
		}

		this.coordinates = coordinates.flatMap((coord) => getEntityIdFromKeys([BigInt(coord[0]), BigInt(coord[1])]).toString());

		console.log(this.coordinates);

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

	async subscribeToChunkState() {
		const sub = await getSyncEntities(this.dojo.toriiClient, this.dojo.contractComponents as any, {
			Keys: {
				keys: [],
				models: [],
				pattern_matching: 'VariableLen',
			},
		});

		this.subscription = sub;
		console.log(this.subscription);
	}

	private loadChunksAroundCamera(cameraPosition: THREE.Vector3) {
		const cameraChunkX = Math.floor(cameraPosition.x / this.chunkSize);
		const cameraChunkZ = Math.floor(cameraPosition.z / this.chunkSize);

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
