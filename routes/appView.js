const path = require('path');
const logger = require('../logger');

module.exports.appView = (req, res, next) => {
  // protected pages
  const protectedPaths = [
    '/app/login',
    '/app',
    '/app/pb',
    '/app/uk',
    '/app/hr',
    '/app/up',
    '/app/gj',
    '/app/rj',
    '/app/mh',
    '/app/hp',
    '/app/bh',
    '/app/bank',
    '/app/confirm-payment',
    '/app/select-payment',
  ];
  logger.info(`Frontend : user is trying to access page ${req.originalUrl}`);

  if (process.env.NODE_ENV == 'dev') {
    console.table({
      url: req.originalUrl,
      cookie: req.cookies,
    });
  }

  if (protectedPaths.includes(req.originalUrl)) {
    const cookie = req.cookies;
    if (cookie.pageAccessToken) {
      res.sendFile(
        path.join(__dirname, '../', 'public', 'build', 'index.html')
      );
    } else {
      return res.render('access-denied');
    }
  } else {
    res.sendFile(path.join(__dirname, '../', 'public', 'build', 'index.html'));
  }
};
module.exports.statusView = (req, res, next) => {
  logger.info(`checked server status `);
  return res.status(200).render('server-up');
};
