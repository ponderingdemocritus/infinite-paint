import React, { useEffect, useState } from 'react';

import { useDojo } from './dojo/useDojo';
import { useComponentValue } from '@dojoengine/react';
import { getEntityIdFromKeys, shortenHex } from '@dojoengine/utils';

const App: React.FC = () => {
	const {
		account: { account },
		setup: {
			client,
			clientComponents: { Player },
		},
	} = useDojo();

	const player = useComponentValue(Player, getEntityIdFromKeys([BigInt(account.address)]));
	const [countdown, setCountdown] = useState<number | null>(null);

	useEffect(() => {
		if (player?.last_action) {
			const updateCountdown = () => {
				const now = Math.floor(Date.now() / 1000);
				const endTime = Number(player.last_action) + 5;
				const remaining = endTime - now;
				setCountdown(remaining > 0 ? remaining : 0);
			};

			updateCountdown();
			const intervalId = setInterval(updateCountdown, 1000);

			return () => clearInterval(intervalId);
		}
		return () => {};
	}, [player?.last_action]);

	const imageMapping = {
		'1': '/textures/rock.png',
		'2': '/textures/paper.png',
		'3': '/textures/scissors.png',
	};

	const FactionSelect = () => (
		<div className='bg-black bg-opacity-50 p-3 rounded-lg'>
			{Object.entries(imageMapping).map(([faction, imageSrc]) => (
				<button
					key={faction}
					className='mr-4 mb-4 hover:bg-white'
					onClick={() => client.actions.create_player({ account, faction: parseInt(faction) })}>
					<img src={imageSrc} alt={`Faction ${faction}`} className='w-16 h-16' />
				</button>
			))}
		</div>
	);

	return (
		<div className='fixed inset-0 flex flex-col pointer-events-none'>
			{player === undefined ? (
				<div className='w-screen h-screen bg-black z-50 overflow-hidden absolute flex justify-center pointer-events-auto'>
					<div className='self-center border-red-400 border p-8 rounded-2xl text-red-400 '>
						<div className='text-2xl uppercase text-center'>Select a faction</div>
						<FactionSelect />

						<div>Rules:</div>
						<div>Burn 1 point placing a unit</div>
						<div>Get 2 points for every touching kill</div>
						<div>Burn 5 points to kill any unit</div>
					</div>
				</div>
			) : (
				<div className='flex-1 relative z-10  '>
					<div className='absolute top-8 left-8 text-xl text-red-500 -skew-y-3'>
						<div>Burn 1 point placing a unit</div>
						<div>Get 2 points for every touching kill</div>
						<div>Burn 5 points to kill any unit</div>
					</div>
					<div className='absolute bottom-8 left-8 text-6xl text-red-500 -skew-y-3'>
						<div>
							<img src={`${imageMapping[player.faction.toString()]}`} alt='' />
						</div>
						<div>{player.points.toString()} points</div>
						<div> {countdown !== null ? `${countdown}s` : 'Ready'}</div>
						<div className='text-lg'>{shortenHex(account.address)}</div>
						<button
							className='text-sm border border-red-500 rounded-lg p-1 pointer-events-auto'
							onClick={() => client.actions.create_player({ account, faction: parseInt(player?.faction.toString()) })}>
							test points
						</button>
					</div>
				</div>
			)}
		</div>
	);
};

export default App;
