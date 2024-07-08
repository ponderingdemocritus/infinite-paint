import { World } from '@dojoengine/recs';
import { ClientComponents } from './createClientComponents';
import type { IWorld } from './generated/generated';

export type SystemCalls = ReturnType<typeof createSystemCalls>;

export function createSystemCalls({ client }: { client: IWorld }, { Tile, Player }: ClientComponents, world: World) {
	return {};
}
