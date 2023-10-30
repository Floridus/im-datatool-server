const models = require('../models');

exports.getIslands = (pagination, sorting, world) => {
  return models.island.findAll({
    include: [
      {
        model: models.world,
        where: {
          number: world ? world : 0,
        },
      },
      {
        model: models.player,
        include: [models.alliance],
      },
      {
        model: models.islandChange,
        include: [
          models.island,
          {
            model: models.player,
            as: 'newOwner',
            include: [models.alliance],
          },
          {
            model: models.player,
            as: 'oldOwner',
            include: [models.alliance],
          },
        ],
      },
    ],
    order: sorting ? [[sorting.field, sorting.order]] : [],
    limit: pagination.perPage,
    offset: (pagination.page - 1) * pagination.perPage,
  })
  .then((islands) => islands);
};

/**
 * Get the oceans count
 *
 * @param world
 * @returns {Promise<number>}
 */
exports.getOceansCount = async (world) => {
  const worldObj = await models.world.findOne({
    where: { number: world },
  });
  if (!worldObj)
    return 1;

  return models.island.findAndCountAll({
    where: { worldId: worldObj.id },
  })
  .then(({ count }) => Math.ceil(count / 100));
};