import React, { useEffect, useState } from 'react';

import { useDojo } from './dojo/useDojo';
import { useComponentValue } from '@dojoengine/react';
import { getEntityIdFromKeys, shortenHex } from '@dojoengine/utils';

const App: React.FC = () => {
	const {
		account: { account },
		setup: {
			clientComponents: { Player },
		},
	} = useDojo();

	const player = useComponentValue(Player, getEntityIdFromKeys([BigInt(account.address)]));
	const [countdown, setCountdown] = useState<number | null>(null);

	useEffect(() => {
		if (player?.last_action) {
			const updateCountdown = () => {
				const now = Math.floor(Date.now() / 1000);
				const endTime = Number(player.last_action) + 15; // Add 60 seconds
				const remaining = endTime - now;
				setCountdown(remaining > 0 ? remaining : 0);
			};

			updateCountdown();
			const intervalId = setInterval(updateCountdown, 1000);

			return () => clearInterval(intervalId);
		}
		return () => {};
	}, [player?.last_action]);

	return (
		<>
			{countdown && countdown > 0 ? <div className='fixed h-screen w-screen cursor-not-allowed bg-transparent'></div> : <></>}

			<div className={`fixed top-0 left-0 right-0 flex justify-between items-start p-4 text-green-500 text-xl -skew-y-3`}>
				<div className='bg-black bg-opacity-50 p-3 rounded-lg'>
					<div>Player: {shortenHex(account.address)}</div>
					{/* <div>Next Action: {countdown !== null ? `${countdown}s` : 'Ready'}</div> */}
				</div>
			</div>
			<div className='absolute bottom-8 left-8 text-6xl text-green-500 -skew-y-3'>
				<div> {countdown !== null ? `${countdown}s` : 'Ready'}</div>
			</div>
		</>
	);
};

export default App;
