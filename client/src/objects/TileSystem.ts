import { defineComponentSystem } from '@dojoengine/recs';
import { SetupResult } from '../dojo/generated/setup';
import { ChunkManager, OFFSET } from './ChunkManager';
import { shortString } from 'starknet';
import * as THREE from 'three';

export class TileSystem {
	private textureLoader: THREE.TextureLoader;
	private textureCache: Map<string, THREE.Texture>;

	constructor(private dojo: SetupResult, private chunkManager: ChunkManager) {
		this.textureLoader = new THREE.TextureLoader();
		this.textureCache = new Map();
	}

	setupTileSystem() {
		defineComponentSystem(this.dojo.world, this.dojo.clientComponents.Tile, (update) => {
			const { value } = update;

			console.log(value);

			this.updateTile(value[0]?.x || 0, value[0]?.y || 0, value[0]?.state.toString() || '');
		});
	}

	private updateTile(x: number, y: number, value: string) {
		const chunkX = Math.floor((x - OFFSET) / this.chunkManager.chunkSize);
		const chunkZ = Math.floor((y - OFFSET) / this.chunkManager.chunkSize);
		const chunkKey = `${chunkX},${chunkZ}`;

		if (this.chunkManager.loadedChunks.has(chunkKey)) {
			const chunk = this.chunkManager.loadedChunks.get(chunkKey)!;
			let localX = (x - OFFSET) % this.chunkManager.chunkSize;
			let localZ = (y - OFFSET) % this.chunkManager.chunkSize;

			// Ensure localX and localZ are always positive
			if (localX < 0) localX += this.chunkManager.chunkSize;
			if (localZ < 0) localZ += this.chunkManager.chunkSize;

			// Swap X and Z when calculating the index
			const tileIndex = localZ + localX * this.chunkManager.chunkSize;

			// console.log(`World coordinates: (${x}, ${y})`);
			// console.log(`Chunk coordinates: (${chunkX}, ${chunkZ})`);
			// console.log(`Local coordinates: (${localX}, ${localZ})`);
			// console.log(`Updating tile at index ${tileIndex}`);

			const tile = chunk.children[tileIndex] as THREE.Mesh;
			if (tile instanceof THREE.Mesh) {
				const hexValue = value;

				console.log('value', hexValue);
				this.applyTextureToTile(tile, hexValue);
			} else {
				console.log(`Tile not found at index ${tileIndex}`);
			}
		} else {
			console.log(`Chunk not loaded for tile at (${x}, ${y})`);
		}
	}

	private applyTextureToTile(tile: THREE.Mesh, hexValue: string) {
		const texturePath = this.getTexturePathFromHex(hexValue);

		if (this.textureCache.has(texturePath)) {
			const texture = this.textureCache.get(texturePath)!;
			this.setTileTexture(tile, texture);
		} else {
			this.textureLoader.load(
				texturePath,
				(texture) => {
					this.textureCache.set(texturePath, texture);
					this.setTileTexture(tile, texture);
				},
				undefined,
				(error) => console.error('Error loading texture:', error)
			);
		}
	}

	private setTileTexture(tile: THREE.Mesh, texture: THREE.Texture) {
		const material = tile.material as THREE.MeshBasicMaterial;
		material.map = texture;
		material.needsUpdate = true;
		material.opacity = 1; // Make fully opaque
	}

	private getTexturePathFromHex(hexValue: string): string {
		// Implement your logic to map hex values to texture paths
		// For example:
		const textureMap: { [key: string]: string } = {
			1: '/textures/rock.png',
			2: '/textures/paper.png',
			3: '/textures/scissors.png',
			// Add more mappings as needed
		};
		return textureMap[hexValue] || '/textures/default.png';
	}
}
