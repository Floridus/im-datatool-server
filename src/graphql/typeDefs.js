const defaultPagination = '{ perPage: 25, page: 1 }';

const typeDefs = `
  scalar Date

  type World {
    id: Int!
    number: Int
  }

  type Alliance {
    id: Int!
    code: String
    name: String
    world: World
    points: Int
    islands: Int
    alliancePointsIncreases: [AlliancePointsIncrease]
  }
  
  type AllianceChange {
    id: Int!
    oldAlly: Alliance
    newAlly: Alliance
    player: Player
    createdAt: Date
  }
  
  type AlliancePointsIncrease {
    id: Int!
    pointsIncrease: Int
    islandsIncrease: Int
    playersIncrease: Int
    dailyDate: String
  }

  type Player {
    id: Int!
    name: String
    points: Int
    alliance: Alliance
    islands: [Island]
    world: World
  }
  
  type Island {
    id: Int!
    number: Int
    name: String
    points: Int
    player: Player
    world: World
    islandChanges: [IslandChange]
  }
  
  type IslandChange {
    id: Int!
    oldOwner: Player
    newOwner: Player
    island: Island
    createdAt: Date
  }
  
  input Pagination {
    page: Int
    perPage: Int
  }
  
  input Sorting {
    field: String!
    order: String!
  }

  type Query {
    players(world: Int, sorting: Sorting, pagination: Pagination = ${defaultPagination}): [Player]
    islands(world: Int, sorting: Sorting, pagination: Pagination = ${defaultPagination}): [Island]
    alliances(world: Int, sorting: Sorting, pagination: Pagination = ${defaultPagination}): [Alliance]
    islandChanges(world: Int, sorting: Sorting, pagination: Pagination = ${defaultPagination}): [IslandChange]
    allianceChanges(world: Int, sorting: Sorting, pagination: Pagination = ${defaultPagination}): [AllianceChange]
    oceansCount(world: Int): Int!
  }
  
  type Mutation {
    createPlayer (
      name: String!
    ): Player
  }
`;

module.exports = typeDefs;