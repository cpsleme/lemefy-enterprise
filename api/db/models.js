const mongoose = require('mongoose');
const { createModels } = require('@lemefy/data-schemas');
const models = createModels(mongoose);

module.exports = { ...models };
