const { trackClientActivity } = require('../utils/helpers');

module.exports = (req, res, next) => {
  trackClientActivity(req);
  next();
};