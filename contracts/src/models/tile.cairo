use starknet::ContractAddress;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

#[derive(Copy, Drop, Serde)]
#[dojo::model]
struct Tile {
    #[key]
    x: u32,
    #[key]
    y: u32,
    color: felt252,
    owner: ContractAddress,
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
struct Player {
    #[key]
    owner: ContractAddress,
    last_action: u64,
    points: u64
}

#[generate_trait]
impl ImplTile of TileTrait {
    fn get_color(self: Tile) -> felt252 {
        self.color
    }

    fn get_neighbours(self: Tile, ref world: IWorldDispatcher) -> Array<Tile> {
        let mut north = get!(world, (self.x, self.y + 1), Tile);
        let mut south = get!(world, (self.x, self.y - 1), Tile);
        let mut east = get!(world, (self.x + 1, self.y), Tile);
        let mut west = get!(world, (self.x - 1, self.y), Tile);

        array![north, south, east, west]
    }

    fn set_neighbours(self: Tile, world: IWorldDispatcher) {
        let mut north = get!(world, (self.x, self.y + 1), Tile);
        if (north.color != 0) {
            north.color = self.color;
            set!(world, (north));
        }

        let mut south = get!(world, (self.x, self.y - 1), Tile);
        if (south.color != 0) {
            south.color = self.color;
            set!(world, (south));
        }

        let mut east = get!(world, (self.x + 1, self.y), Tile);
        if (east.color != 0) {
            east.color = self.color;
            set!(world, (east));
        }
        let mut west = get!(world, (self.x - 1, self.y), Tile);
        if (west.color != 0) {
            west.color = self.color;
            set!(world, (west));
        }
    }
}

#[cfg(test)]
mod tests {}

