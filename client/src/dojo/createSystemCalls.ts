import { AccountInterface, shortString } from 'starknet';
import { Entity, Has, HasValue, World, defineSystem, getComponentValue } from '@dojoengine/recs';
import { uuid } from '@latticexyz/utils';
import { ClientComponents } from './createClientComponents';
import { getEntityIdFromKeys } from '@dojoengine/utils';
import { ContractComponents } from './generated/contractComponents';
import type { IWorld } from './generated/generated';

export type SystemCalls = ReturnType<typeof createSystemCalls>;

export function createSystemCalls(
	{ client }: { client: IWorld },

	{ Tile, Player }: ClientComponents,
	world: World
) {
	const paint = async ({ account, x, y, color }: { account: AccountInterface; x: number; y: number; color: string }) => {
		const tileId = uuid();

		console.log('Painting tile', { x, y, color, account });

		Tile.addOverride(tileId, {
			entity: getEntityIdFromKeys([BigInt(x), BigInt(y)]) as Entity,
			value: {
				x,
				y,
				color: BigInt(shortString.encodeShortString(color)),
				owner: BigInt(account.address),
			},
		});

		console.log(getComponentValue(Tile, getEntityIdFromKeys([BigInt(x), BigInt(y)]) as Entity));

		try {
			await client.actions.paint({
				account,
				x: x.toString(),
				y: y.toString(),
				color: shortString.encodeShortString(color),
			});

			// Wait for the indexer to update the entity
			// By doing this we keep the optimistic UI in sync with the actual state
			// await new Promise<void>((resolve) => {
			// 	defineSystem(world, [Has(Player)], () => {
			// 		console.log('Tile updated');
			// 		resolve();
			// 	});
			// });
		} catch (e) {
			console.log(e);
			// Tile.removeOverride(tileId);
		} finally {
			// Tile.removeOverride(tileId);
		}
	};
	return {
		paint,
	};
}
