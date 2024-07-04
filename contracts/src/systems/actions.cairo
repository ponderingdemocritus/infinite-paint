// define the interface
#[dojo::interface]
trait IActions {
    fn create_player(ref world: IWorldDispatcher);
    fn paint(ref world: IWorldDispatcher, x: u32, y: u32, color: felt252);
}

// dojo decorator
#[dojo::contract]
mod actions {
    use super::{IActions};
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use dojo_starter::models::{tile::{Tile, TileTrait, Player}};

    #[abi(embed_v0)]
    impl ActionsImpl of IActions<ContractState> {
        fn create_player(ref world: IWorldDispatcher) {
            let owner = get_caller_address();

            let existing = get!(world, (owner), Player);

            assert(existing.owner.into() == 0, 'address already player');

            set!(world, Player { owner: get_caller_address(), last_action: 0, points: 0 });
        }

        fn paint(ref world: IWorldDispatcher, x: u32, y: u32, color: felt252) {
            let owner = get_caller_address();

            let mut player = get!(world, (owner), Player);

            let mut tile = get!(world, (x, y), Tile);

            if (tile.color != 0) {
                assert(owner == tile.owner, 'Tile already painted');
            }

            tile.color = color;
            tile.owner = owner;
            tile.set_neighbours(world);

            set!(world, (tile));

            assert(player.last_action + 60 <= get_block_timestamp(), 'time not up');

            player.last_action = get_block_timestamp();

            set!(world, (player));
        }
    }
}
