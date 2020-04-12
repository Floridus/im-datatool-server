const models = require('../models');

exports.getIslandChanges = (pagination, sorting, world) => {
  return models.islandChange.findAll({
    include: [
      models.world,
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
    order: sorting ? [[sorting.field, sorting.order]] : [],
    limit: pagination.perPage,
    offset: (pagination.page - 1) * pagination.perPage,
  })
  .then((islandChanges) => islandChanges);
};