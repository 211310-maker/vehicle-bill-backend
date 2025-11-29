const express = require('express');
const dotenv = require('dotenv');
const app = express();
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const xssClean = require('xss-clean');
const hpp = require('hpp');
const path = require('path');
const pdf = require('express-pdf');
const cookieParser = require('cookie-parser');
const logger = require('./logger');
require('colors');
// process.env.TZ = 'Asia/Kolkata';
dotenv.config({
  path: `${path.join(__dirname, 'config', process.env.NODE_ENV)}.env`,
});

// routes imports
const authRoute = require('./routes/auth');
const billRoute = require('./routes/bill');
const { appView, statusView } = require('./routes/appView');
const errorHandler = require('./middleware/error');

// middleware
app.use(
  '/static',
  express.static(path.join(__dirname, 'public', 'build', 'static'))
);
app.use(express.static(path.join(__dirname, 'public/'), { index: false }));
app.use(pdf);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use('*', cors());
app.use(helmet());
app.use(xssClean());
app.use(hpp());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// routes;
app.use('/auth', authRoute);
app.use('/bill', billRoute);
app.use('/app', appView);
app.get('/check', statusView);

app.use(errorHandler);

// euncaught exception handling
process.on('uncaughtException', (err, promise) => {
  logger.error(err.message);
  process.exit(1);
});

process.on('unhandledRejection', (err, promise) => {
  logger.error(err.message);
  process.exit(1);
});

module.exports = app;
