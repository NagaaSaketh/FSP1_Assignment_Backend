const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true,
        unique:true,
    }
},{collection: "asana_tags"})

const Tag = mongoose.model('Tag',tagSchema)

module.exports = Tag;