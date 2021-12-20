const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const previewSchema = mongoose.Schema({
    url: {
        type: String
    },
    username: {
        type: String
    }
}, { timestamps: true })


const Preview = mongoose.model('Preview', previewSchema);

module.exports = { Preview }


