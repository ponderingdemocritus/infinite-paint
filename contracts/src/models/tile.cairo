use starknet::ContractAddress;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};


mod States {
    const ROCK: felt252 = 1;
    const PAPER: felt252 = 2;
    const SCISSORS: felt252 = 3;
}

#[derive(Copy, Drop, Serde,)]
#[dojo::model]
struct Tile {
    #[key]
    pub x: u32,
    #[key]
    pub y: u32,
    pub state: felt252,
    pub owner: ContractAddress,
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
struct Player {
    #[key]
    pub owner: ContractAddress,
    pub last_action: u64,
    pub points: u64,
    pub faction: felt252,
}

#[generate_trait]
impl ImplTile of TileTrait {
    fn get_state(self: Tile) -> felt252 {
        self.state
    }

    fn get_neighbours(self: Tile, world: IWorldDispatcher) -> Array<Tile> {
        let mut north = get!(world, (self.x, self.y + 1), Tile);
        let mut south = get!(world, (self.x, self.y - 1), Tile);
        let mut east = get!(world, (self.x + 1, self.y), Tile);
        let mut west = get!(world, (self.x - 1, self.y), Tile);

        array![north, south, east, west]
    }

    fn set_neighbours(self: Tile, world: IWorldDispatcher) -> u64 {
        let mut points_gained = 0;
        let neighbours = self.get_neighbours(world);

        let mut i = 0;
        loop {
            if i >= neighbours.len() {
                break;
            }
            let mut neighbour = *neighbours[i];
            if neighbour.state != 0 && self.beats(neighbour.state) {
                neighbour.state = self.state;
                neighbour.owner = self.owner;
                set!(world, (neighbour));
                points_gained += 2;
            }
            i += 1;
        };

        points_gained
    }

    fn beats(self: Tile, other_state: felt252) -> bool {
        // Assuming: 1 = Rock, 2 = Paper, 3 = Scissors
        (self.state == States::ROCK && other_state == States::SCISSORS)
            || // Rock beats Scissors
             (self.state == States::PAPER && other_state == States::ROCK)
            || // Paper beats Rock
            (self.state == States::SCISSORS
                && other_state == States::PAPER) // Scissors beats Paper
    }
}

#[cfg(test)]
mod tests {
    use super::{ImplTile, Tile, Player, States};


    #[test]
    fn test_rock_beats_scissors() {
        let tile = Tile { x: 0, y: 0, state: States::ROCK, owner: 1.try_into().unwrap() };
        let other_state = States::SCISSORS;
        assert!(tile.beats(other_state));
    }

    #[test]
    fn test_paper_beats_rock() {
        let tile = Tile { x: 0, y: 0, state: States::PAPER, owner: 1.try_into().unwrap() };
        let other_state = States::ROCK;
        assert!(tile.beats(other_state));
    }

    #[test]
    fn test_scissors_beats_paper() {
        let tile = Tile { x: 0, y: 0, state: States::SCISSORS, owner: 1.try_into().unwrap() };
        let other_state = States::PAPER;
        assert!(tile.beats(other_state));
    }
}

