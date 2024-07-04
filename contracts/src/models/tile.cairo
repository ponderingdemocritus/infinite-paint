use starknet::ContractAddress;

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

#[cfg(test)]
mod tests {}

