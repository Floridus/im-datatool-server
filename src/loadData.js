const dotenv = require('dotenv');
const moment = require('moment-timezone');

// to load .env file
const dotEnvConfig = dotenv.config();
if (dotEnvConfig.error) {
  throw dotEnvConfig.error;
}

moment.tz.setDefault('Europe/Vienna');

const { sequelize } = require('./models');
const { getWorldData } = require('./utils/api');

// function to test if the connection is OK
sequelize.authenticate()
.then(() => console.log('Connection has been established successfully.'))
.catch(error => console.error('Unable to connect to the database:', error));

getWorldData(54);