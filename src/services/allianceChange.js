const models = require('../models');

exports.getAllianceChanges = (pagination, sorting, world) => {
  return models.allianceChange.findAll({
    include: [
      {
        model: models.world,
        where: {
          number: world ? world : 0,
        },
      },
      models.player,
      {
        model: models.alliance,
        as: 'newAlly',
      },
      {
        model: models.alliance,
        as: 'oldAlly',
      },
    ],
    order: sorting ? [[sorting.field, sorting.order]] : [],
    limit: pagination.perPage,
    offset: (pagination.page - 1) * pagination.perPage,
  })
  .then((allianceChanges) => allianceChanges);
};