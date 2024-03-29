const moment = require('moment-timezone');
const { Op } = require('sequelize');
// only for node version under v18
const fetch = require('node-fetch');

const models = require('../models');

async function findOrInsertAllIslands (data, world) {
  const today = moment()
  .format('YYYY-MM-DD');

  if (data.error) {
    console.error('ERROR:', data.error)
    return
  }

  const results = data.result ? data.result : [];

  for (const line of results) {
    const [player] = await models.player.findOrCreate({
      where: { name: line.besitzer },
      include: [
        {
          model: models.world,
          where: {
            number: world.number,
          },
        },
      ],
      defaults: {
        points: 0,
        worldId: world.id,
      },
    });

    const [island, created] = await models.island.findOrCreate({
      where: { number: line.insel },
      include: [
        {
          model: models.world,
          where: {
            number: world.number,
          },
        },
        models.player,
      ],
      defaults: {
        name: line.inselname,
        points: line.punkte,
        playerId: player.id,
        worldId: world.id,
      },
    });

    const [islandPointsIncrease] = await models.islandPointsIncrease.findOrCreate({
      where: {
        islandId: island.id,
        dailyDate: today,
      },
    });

    if (!created) {
      let saveIsland = false;
      if (island.points !== line.punkte) {
        const pointsIncrease = line.punkte - island.points;

        islandPointsIncrease.pointsIncrease += pointsIncrease;
        await islandPointsIncrease.save();

        island.points = line.punkte;
        saveIsland = true;
      }

      // island owner change
      if (island.playerId !== player.id) {
        await models.islandChange.create({
          islandId: island.id,
          oldOwnerId: island.playerId,
          newOwnerId: player.id,
          worldId: world.id,
        });

        island.playerId = player.id;
        saveIsland = true;
      }
      if (saveIsland)
        await island.save();
    }

    let alliance = null;
    // Check ob der Spieler eine Allianz hat
    if (line.allianz_short) {
      const [obj] = await models.alliance.findOrCreate({
        where: {
          [Op.or]: [
            { code: line.allianz_short },
            { name: line.allianz_long },
          ],
        },
        include: [
          {
            model: models.world,
            where: {
              number: world.number,
            },
          },
        ],
        defaults: {
          worldId: world.id,
          code: line.allianz_short,
          name: line.allianz_long,
        },
      });

      // if code or name is same but the other one isn't it
      if (obj.code !== line.allianz_short || obj.name !== line.allianz_long) {
        obj.code = line.allianz_short;
        obj.name = line.allianz_long;
        obj.save();
      }
      alliance = obj;
    }

    const tmpPlayerAllianceId = player.allianceId;

    // alliance change
    if (alliance && tmpPlayerAllianceId !== alliance.id) {
      player.allianceId = alliance.id;
      await player.save();

      await models.allianceChange.create({
        playerId: player.id,
        oldAllyId: tmpPlayerAllianceId ? tmpPlayerAllianceId : null,
        newAllyId: alliance.id,
        worldId: world.id,
      });
    } else if (!alliance && tmpPlayerAllianceId) {
      player.allianceId = null;
      await player.save();

      await models.allianceChange.create({
        playerId: player.id,
        oldAllyId: tmpPlayerAllianceId,
        worldId: world.id,
      });
    }
  }
}

async function updateAllPoints (world) {
  console.log('finish all inserts and updates');
  console.log('start all point updates');

  const today = moment()
  .format('YYYY-MM-DD');

  await models.alliance.update({ points: 0, islands: 0 }, { where: { worldId: world.id } });

  const players = await models.player.findAll({
    include: [
      {
        model: models.world,
        where: {
          number: world.number,
        },
      },
      {
        model: models.island,
        include: [{
          model: models.islandPointsIncrease,
          where: { dailyDate: today },
        }],
      },
      models.alliance,
    ],
  });
  const alliances = [];

  const playerBulkUpdate = [];
  const aPIBulkUpdate = [];
  for (const player of players) {
    let points = 0;
    let playerIncreasePoints = 0;

    for (const island of player.islands) {
      points += island.points;
      playerIncreasePoints += island.islandPointsIncreases[0].pointsIncrease;
    }

    const [playerPointsIncrease] = await models.playerPointsIncrease.findOrCreate({
      where: {
        playerId: player.id,
        dailyDate: today,
      },
    });

    if (playerIncreasePoints !== 0) {
      playerPointsIncrease.pointsIncrease = playerIncreasePoints;
      await playerPointsIncrease.save();
    }

    if (player.points !== points) {
      playerBulkUpdate.push({
        id: player.id, points,
        name: player.name,
        worldId: world.id
      });
    }

    if (player.allianceId) {
      const allianceCode = player.alliance.code;

      const allianceIdx = alliances.findIndex(alliance => alliance.code === allianceCode);

      if (allianceIdx === -1) {
        player.alliance.points = 0;
        player.alliance.islands = 0;
        alliances.push(player.alliance);
      }

      const allyIdx = allianceIdx !== -1 ? allianceIdx : alliances.length - 1;
      alliances[allyIdx].points += points;
      alliances[allyIdx].islands += player.islands.length;

      const [alliancePointsIncrease] = await models.alliancePointsIncrease.findOrCreate({
        where: {
          allianceId: player.allianceId,
          dailyDate: today,
        },
      });

      const aPIBulkAllyIdx = aPIBulkUpdate.findIndex(aPIObj => aPIObj.id === alliancePointsIncrease.id);
      // Increase the old alliance with points
      if (aPIBulkAllyIdx === -1) {
        aPIBulkUpdate.push({
          id: alliancePointsIncrease.id,
          pointsIncrease: playerIncreasePoints,
        });
      } else {
        aPIBulkUpdate[aPIBulkAllyIdx].pointsIncrease += playerIncreasePoints;
      }
    }
  }

  if (playerBulkUpdate.length > 0) {
    await models.player.bulkCreate(playerBulkUpdate, { updateOnDuplicate: ['points'] });
  }

  const allianceBulkUpdate = [];
  for (const alliance of alliances) {
    allianceBulkUpdate.push({
      id: alliance.id,
      code: alliance.code,
      name: alliance.name,
      points: alliance.points,
      islands: alliance.islands,
      worldId: world.id
    });
  }

  if (allianceBulkUpdate.length > 0) {
    await models.alliance.bulkCreate(allianceBulkUpdate, { updateOnDuplicate: ['points', 'islands'] });
  }

  if (aPIBulkUpdate.length > 0) {
    await models.alliancePointsIncrease.bulkCreate(aPIBulkUpdate, { updateOnDuplicate: ['pointsIncrease'] });
  }

  await checkIslandAndAllianceChanges(world);
}

async function checkIslandAndAllianceChanges (world) {
  console.log('finished all point updates');
  console.log('start checking island and alliance changes');

  const today = moment()
  .format('YYYY-MM-DD');

  const allianceChanges = await models.allianceChange.findAll({
    where: {
      createdAt: { [Op.between]: [today + ' 00:00:00', today + ' 23:59:59'] },
      worldId: world.id,
    },
    include: [
      {
        model: models.player,
        include: [
          models.island,
          {
            model: models.playerPointsIncrease,
            where: { dailyDate: today },
          },
        ],
      },
      {
        model: models.alliance,
        as: 'oldAlly',
        include: [{
          model: models.alliancePointsIncrease,
          where: { dailyDate: today },
        }],
      },
      {
        model: models.alliance,
        as: 'newAlly',
        include: [{
          model: models.alliancePointsIncrease,
          where: { dailyDate: today },
        }],
      },
    ],
  });

  const aPIBulkUpdate = [];
  const pPIBulkUpdate = [];
  for (const allianceChange of allianceChanges) {
    const { player, oldAlly, newAlly } = allianceChange;
    const playerIslandsCount = player.islands.length;

    if (oldAlly) {
      const oldAllyIncrease = oldAlly.alliancePointsIncreases[0];
      const aPIBulkOldAllyIdx = aPIBulkUpdate.findIndex(aPIObj => aPIObj.id === oldAllyIncrease.id);

      // Decrease the old alliance with points and islands
      if (aPIBulkOldAllyIdx === -1) {
        aPIBulkUpdate.push({
          id: oldAllyIncrease.id,
          pointsIncrease: oldAllyIncrease.pointsIncrease - player.points,
          islandsIncrease: -playerIslandsCount,
          playersIncrease: -1,
        });
      } else {
        aPIBulkUpdate[aPIBulkOldAllyIdx].pointsIncrease -= player.points;
        aPIBulkUpdate[aPIBulkOldAllyIdx].islandsIncrease -= playerIslandsCount;
        aPIBulkUpdate[aPIBulkOldAllyIdx].playersIncrease -= 1;
      }
    }

    if (newAlly) {
      const newAllyIncrease = newAlly.alliancePointsIncreases[0];
      const aPIBulkNewAllyIdx = aPIBulkUpdate.findIndex(aPIObj => aPIObj.id === newAlly.id);
      const playerPointsIncrease = player.playerPointsIncreases[0].pointsIncrease;

      // Increase the old alliance with points and islands
      if (aPIBulkNewAllyIdx === -1) {
        aPIBulkUpdate.push({
          id: newAllyIncrease.id,
          pointsIncrease: newAllyIncrease.pointsIncrease + (player.points - playerPointsIncrease), // because player points increase has already been added
          islandsIncrease: playerIslandsCount,
          playersIncrease: 1,
        });
      } else { // because player points increase has already been added
        aPIBulkUpdate[aPIBulkNewAllyIdx].pointsIncrease += player.points - playerPointsIncrease;
        aPIBulkUpdate[aPIBulkNewAllyIdx].islandsIncrease += playerIslandsCount;
        aPIBulkUpdate[aPIBulkNewAllyIdx].playersIncrease += 1;
      }
    }
  }

  const islandChanges = await models.islandChange.findAll({
    where: {
      createdAt: { [Op.between]: [today + ' 00:00:00', today + ' 23:59:59'] },
      worldId: world.id,
    },
    include: [
      {
        model: models.player,
        as: 'newOwner',
        include: [
          {
            model: models.playerPointsIncrease,
            where: { dailyDate: today },
          },
          {
            model: models.alliance,
            include: [{
              model: models.alliancePointsIncrease,
              where: { dailyDate: today },
            }],
          },
        ],
      },
      {
        model: models.player,
        as: 'oldOwner',
        include: [
          {
            model: models.playerPointsIncrease,
            where: { dailyDate: today },
          },
          {
            model: models.alliance,
            include: [{
              model: models.alliancePointsIncrease,
              where: { dailyDate: today },
            }],
          },
        ],
      },
      {
        model: models.island,
        include: [{
          model: models.islandPointsIncrease,
          where: { dailyDate: today },
        }],
      },
    ],
  });

  for (const islandChange of islandChanges) {
    const { island, oldOwner, newOwner } = islandChange;
    const islandPoints = island.points;

    const oldOwnerIncrease = oldOwner.playerPointsIncreases[0];
    const pPIBulkOldOwnerIdx = pPIBulkUpdate.findIndex(pPIObj => pPIObj.id === oldOwnerIncrease.id);

    // Decrease the old owner with points and islands
    if (pPIBulkOldOwnerIdx === -1) {
      pPIBulkUpdate.push({
        id: oldOwnerIncrease.id,
        pointsIncrease: oldOwnerIncrease.pointsIncrease - islandPoints,
        islandsIncrease: oldOwnerIncrease.islandsIncrease - 1,
      });
    } else {
      pPIBulkUpdate[pPIBulkOldOwnerIdx].pointsIncrease -= islandPoints;
      pPIBulkUpdate[pPIBulkOldOwnerIdx].islandsIncrease -= 1;
    }

    const newOwnerIncrease = newOwner.playerPointsIncreases[0];
    const pPIBulkNewOwnerIdx = pPIBulkUpdate.findIndex(pPIObj => pPIObj.id === newOwnerIncrease.id);

    // Increase the new owner with island
    if (pPIBulkNewOwnerIdx === -1) {
      pPIBulkUpdate.push({
        id: newOwnerIncrease.id,
        islandsIncrease: newOwnerIncrease.islandsIncrease + 1,
        pointsIncrease: newOwnerIncrease.pointsIncrease,
      });
    } else {
      pPIBulkUpdate[pPIBulkNewOwnerIdx].islandsIncrease += 1;
    }

    if (oldOwner.allianceId) {
      const oldAllyIncrease = oldOwner.alliance.alliancePointsIncreases[0];
      const aPIBulkOldAllyIdx = aPIBulkUpdate.findIndex(aPIObj => aPIObj.id === oldAllyIncrease.id);

      // Decrease the old alliance with points and islands
      if (aPIBulkOldAllyIdx === -1) {
        aPIBulkUpdate.push({
          id: oldAllyIncrease.id,
          pointsIncrease: oldAllyIncrease.pointsIncrease - islandPoints,
          islandsIncrease: oldAllyIncrease.islandsIncrease - 1,
        });
      } else {
        aPIBulkUpdate[aPIBulkOldAllyIdx].pointsIncrease -= islandPoints;
        aPIBulkUpdate[aPIBulkOldAllyIdx].islandsIncrease -= 1;
      }
    }
    if (newOwner.allianceId) {
      const newAllyIncrease = newOwner.alliance.alliancePointsIncreases[0];
      const aPIBulkNewAllyIdx = aPIBulkUpdate.findIndex(aPIObj => aPIObj.id === newAllyIncrease.id);
      const islandPointsIncrease = island.islandPointsIncreases[0].pointsIncrease;

      // Increase the new alliance with points and islands
      if (aPIBulkNewAllyIdx === -1) {
        aPIBulkUpdate.push({
          id: newAllyIncrease.id,
          pointsIncrease: newAllyIncrease.pointsIncrease + (islandPoints - islandPointsIncrease),
          islandsIncrease: newAllyIncrease.islandsIncrease + 1,
        });
      } else {
        aPIBulkUpdate[aPIBulkNewAllyIdx].pointsIncrease += islandPoints;
        aPIBulkUpdate[aPIBulkNewAllyIdx].islandsIncrease += 1;
      }
    }
  }

  if (pPIBulkUpdate.length > 0) {
    await models.playerPointsIncrease.bulkCreate(pPIBulkUpdate, { updateOnDuplicate: ['pointsIncrease', 'islandsIncrease'] });
  }

  if (aPIBulkUpdate.length > 0) {
    await models.alliancePointsIncrease.bulkCreate(aPIBulkUpdate, { updateOnDuplicate: ['pointsIncrease', 'playersIncrease', 'islandsIncrease'] });
  }
}

function getJSONWorldData (world) {
  const data = {
    "api_key": "417f0029b82cf1efb4641178f292fd13",
    "server": world.number,
    "command": "islandlist"
  }

  fetch(`https://www.insel-monarchie.de/v2_ext_tool/get.php`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
      .then(response => response.json())
      .then(async (data) => {
        await findOrInsertAllIslands(data, world);
        await updateAllPoints(world);
      })
      .catch(err => console.error(err));
}

async function getWorldData (worldKey) {
  const [world] = await models.world.findOrCreate({
    where: { number: worldKey },
  });

  if (world) {
    getJSONWorldData(world)
  }
}

module.exports = {
  getWorldData,
};