/**
 * Created by yytang on 5/23/17.
 */

// Mongoose with Q wrapper
var mongoose = require('mongoose-q')(require('mongoose'));

module.exports = function(svmp) {
    if(!mongoose.connection.db) {
        var dbname;
        if(process.env.NODE_ENV === 'production') {
            dbname = svmp.config.get('db:production');
        } else {
            dbname = svmp.config.get('db:test');
        }
        mongoose.connect(dbname);
        svmp.logger.info("Mongoose:  connected to: " + dbname);
        mongoose.connection.on('error', function(err) {
            svmp.logger.error("Problem connecting to mongdb. Is it running? " + err );
            process.exit(1);
        });
        mongoose.connection.on('disconnected', function() {
            svmp.logger.info("Mongoose:  disconnected connection");
        });
    }
    return mongoose;
};