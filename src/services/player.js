const { Op } = require('sequelize');

const models = require('../models');

exports.getPlayers = (pagination, sorting, world) => {
  return models.player.findAll({
    where: {
      points: {
        [Op.gt]: 0,
      },
      name: {
        [Op.ne]: 'unbewohnt',
      },
    },
    include: [
      models.alliance,
      models.island,
      {
        model: models.world,
        where: {
          number: world ? world : 0,
        },
      },
      {
        model: models.playerPointsIncrease,
        limit: 1,
        order: [['createdAt', 'DESC']],
      },
    ],
    order: sorting ? [[sorting.field, sorting.order]] : [],
    limit: pagination.perPage,
    offset: (pagination.page - 1) * pagination.perPage,
  })
  .then((players) => players);
};

exports.createPlayer = (name) => {
  return models.player.create({
    name,
  })
  .then((player) => player);
};

/**
 * Get the players count
 *
 * @param world
 * @param perPage - important to know, how many players per page
 * @returns {Promise<number>}
 */
exports.getPlayersCount = async (world, perPage) => {
  const worldObj = await models.world.findOne({
    where: { number: world },
  });
  if (!worldObj)
    return 1;

  return models.player.findAndCountAll({
    where: { worldId: worldObj.id },
  })
  .then(({ count }) => Math.ceil(count / perPage));
};