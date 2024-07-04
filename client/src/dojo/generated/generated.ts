/* Autogenerated file. Do not edit manually. */

import { Account, AccountInterface } from 'starknet';
import { DojoProvider } from '@dojoengine/core';
import { Direction } from '../../utils';

export type IWorld = Awaited<ReturnType<typeof setupWorld>>;

export interface MoveProps {
	account: Account | AccountInterface;
	direction: Direction;
}

export async function setupWorld(provider: DojoProvider) {
	function actions() {
		const create_player = async ({ account }: { account: AccountInterface }) => {
			try {
				return await provider.execute(account, {
					contractName: 'actions',
					entrypoint: 'create_player',
					calldata: [],
				});
			} catch (error) {
				console.error('Error executing spawn:', error);
				throw error;
			}
		};
		const paint = async ({ account, x, y, color }: { account: AccountInterface; x: string; y: string; color: string }) => {
			try {
				return await provider.execute(account, {
					contractName: 'actions',
					entrypoint: 'paint',
					calldata: [x, y, color],
				});
			} catch (error) {
				console.error('Error executing spawn:', error);
				throw error;
			}
		};
		return { paint, create_player };
	}
	return {
		actions: actions(),
	};
}
