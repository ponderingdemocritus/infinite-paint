// define the interface
#[dojo::interface]
trait IActions {
    fn create_player(ref world: IWorldDispatcher, faction: felt252);
    fn paint(ref world: IWorldDispatcher, x: u32, y: u32);
}

// dojo decorator
#[dojo::contract]
mod actions {
    use super::{IActions};
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use rps_game::models::{tile::{Tile, TileTrait, Player}};

    #[abi(embed_v0)]
    impl ActionsImpl of IActions<ContractState> {
        fn create_player(ref world: IWorldDispatcher, faction: felt252) {
            let owner = get_caller_address();

            let existing = get!(world, (owner), Player);

            // TODO: Auth

            set!(world, Player { owner: get_caller_address(), last_action: 0, points: 5, faction });
        }

        fn paint(ref world: IWorldDispatcher, x: u32, y: u32) {
            let owner = get_caller_address();

            let mut player = get!(world, (owner), Player);

            assert(player.points > 0, 'not enough points');

            let mut tile = get!(world, (x, y), Tile);

            if (tile.state != 0) {
                assert(owner == tile.owner, 'Tile already painted');
            }

            tile.state = player.faction;
            tile.owner = owner;
            let points = tile.set_neighbours(world);

            set!(world, (tile));

            assert(player.last_action + 5 <= get_block_timestamp(), 'time not up');

            player.last_action = get_block_timestamp();
            player.points = player.points - 1 + points;

            set!(world, (player));
        }
    }
}
