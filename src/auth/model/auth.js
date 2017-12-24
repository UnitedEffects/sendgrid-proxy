/**
 * Created by borzou on 9/27/16.
 */
/**
 * Created by borzou on 9/27/16.
 */
var Promise = require('bluebird');
var mongoose = Promise.promisifyAll(require('mongoose'));
var bcrypt = require('bcrypt-nodejs');

// Define our user schema
// There are 2 kinds or roles. User (code=0) and Admin (code=1).
var grantCodeSchema = new mongoose.Schema({
    code: {
        type: String,
        unique: true,
        required: true
    },
    user_id: {
        type: String,
        required: true
    },
    user: {
        type: Object,
        required: true
    },
    domain: {
        type: String,
        required: true
    },
    created: {
        type: Date,
        default: Date.now
    },
    expires: {
        type: Date,
        required: true,
        expires: 0
    }
});

// Execute before each user.save() call
grantCodeSchema.pre('save', function(callback) {
    var gcode = this;

    // Break out if the password hasn't changed
    if (!gcode.isModified('code')) return callback();

    // Password changed so we need to hash it
    bcrypt.genSalt(5, function(err, salt) {
        if (err) return callback(err);

        bcrypt.hash(gcode.code, salt, null, function(err, hash) {
            if (err) return callback(err);
            gcode.code = hash;
            callback();
        });
    });
});

grantCodeSchema.methods.verifyCode = function(code, callback) {
    bcrypt.compare(code, this.code, function(err, isMatch) {
        if (err) return callback(err);
        callback(null, isMatch);
    });
};

// Export the Mongoose model
module.exports = mongoose.model('Code', grantCodeSchema);