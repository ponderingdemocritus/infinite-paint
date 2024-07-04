// define the interface
#[dojo::interface]
trait IActions {
    fn paint(ref world: IWorldDispatcher, x: u32, y: u32, color: felt252);
}

// dojo decorator
#[dojo::contract]
mod actions {
    use super::{IActions};
    use starknet::{ContractAddress, get_caller_address};
    use dojo_starter::models::{tile::{Tile}};

    #[abi(embed_v0)]
    impl ActionsImpl of IActions<ContractState> {
        fn paint(ref world: IWorldDispatcher, x: u32, y: u32, color: felt252) {
            let owner = get_caller_address();

            set!(world, (Tile { x, y, color, owner }));
        }
    }
}
