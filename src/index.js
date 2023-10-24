const express = require('express');
const expressGraphQL = require('express-graphql');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const moment = require('moment-timezone');
const CronJob = require('cron').CronJob;

// to load .env file
const dotEnvConfig = dotenv.config();
if (dotEnvConfig.error) {
  throw dotEnvConfig.error;
}

moment.tz.setDefault('Europe/Vienna');

const { sequelize } = require('./models');
const { getWorldData } = require('./utils/api');
// Construct a schema, using GraphQL schema language
const schema = require('./graphql/schema');

// function to test if the connection is OK
sequelize.authenticate()
.then(() => console.log('Connection has been established successfully.'))
.catch(error => console.error('Unable to connect to the database:', error));

const app = express();
const port = process.env.APP_PORT;

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

// enable cors for graphql endpoint
app.use('/graphql', [cors()], expressGraphQL(
  () => ({
    schema: schema,
    graphiql: true,
  }),
));

app.listen(port, () => {
  console.log(`🚀 Local server ready at http://localhost:${port}`);
});

// at minute 3 past every 2nd hour
new CronJob('0 3 */2 * * *', function () {
  console.log('WORLD 54: You will see this message every two hours');
  getWorldData(54);
}, null, true, 'Europe/Vienna');

// at minute 8 past every 2nd hour
/*new CronJob('0 8 *!/2 * * *', function () {
  console.log('WORLD 48: You will see this message every two hours');
  getWorldData(48);
}, null, true, 'Europe/Vienna');*/
