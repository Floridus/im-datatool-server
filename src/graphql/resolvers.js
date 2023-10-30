const { GraphQLScalarType } = require('graphql');
const { Kind } = require('graphql/language');

const PlayerService = require('../services/player');
const IslandService = require('../services/island');
const IslandChangeService = require('../services/islandChange');
const AllianceService = require('../services/alliance');
const AllianceChangeService = require('../services/allianceChange');

const resolvers = {
  Query: {
    players: (_, { world, sorting, pagination }) => {
      return PlayerService.getPlayers(pagination, sorting, world);
    },
    islands: (_, { world, sorting, pagination }) => {
      return IslandService.getIslands(pagination, sorting, world);
    },
    islandChanges: (_, { world, sorting, pagination }) => {
      return IslandChangeService.getIslandChanges(pagination, sorting, world);
    },
    alliances: (_, { world, sorting, pagination }) => {
      return AllianceService.getAlliances(pagination, sorting, world);
    },
    allianceChanges: (_, { world, sorting, pagination }) => {
      return AllianceChangeService.getAllianceChanges(pagination, sorting, world);
    },
    oceansCount: (_, { world }) => {
      return IslandService.getOceansCount(world);
    },
  },
  Mutation: {
    createPlayer: (_, { name }) => {
      if (!name) {
        throw new Error(`No name is given`);
      }

      return PlayerService.createPlayer(name);
    },
  },
  Date: new GraphQLScalarType({
    name: 'Date',
    description: 'Date custom scalar type',
    parseValue (value) {
      return new Date(value); // value from the client
    },
    serialize (value) {
      return value.getTime(); // value sent to the client
    },
    parseLiteral (ast) {
      if (ast.kind === Kind.INT) {
        return new Date(ast.value); // ast value is always in string format
      }
      return null;
    },
  }),
};

module.exports = resolvers;