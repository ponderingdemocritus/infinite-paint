import { AccountInterface } from 'starknet';
import { Entity, getComponentValue } from '@dojoengine/recs';
import { uuid } from '@latticexyz/utils';
import { ClientComponents } from './createClientComponents';
import { Direction, updatePositionWithDirection } from '../utils';
import { getEntityIdFromKeys } from '@dojoengine/utils';
import { ContractComponents } from './generated/contractComponents';
import type { IWorld } from './generated/generated';

export type SystemCalls = ReturnType<typeof createSystemCalls>;

export function createSystemCalls({ client }: { client: IWorld }, _contractComponents: ContractComponents, {}: ClientComponents) {
	return {};
}
