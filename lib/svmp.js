/*
 * Copyright 2013-2014 The MITRE Corporation, All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this work except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @author Dave Bryson
 */

/**
 * Main namespace object used through-out the app.
 *
 * @exports svmp
 */
var svmp = {};

module.exports = svmp;

/**
 * Current version used. Read from package.json
 * @type {String}
 */
svmp.VERSION = require('../package.json').version;

/**
 * Called at start of App.  Initializes the core modules
 */
svmp.init = function() {

    /**** Setup ****/

    // Winston and wrap in out global name space
    svmp.logger = require('./logger');
    svmp.logger.beforeConfig();


    // Config with validation
    svmp.config = require('./config')();

    svmp.logger.afterConfig();

    var cloud = svmp.config.get('cloud_platform');
    if (cloud === "openstack") {
        svmp.cloud = require('./cloud/openstack');
    } else if (cloud === "aws") {
        svmp.cloud = require('./cloud/aws');
    }
    svmp.cloud.init();

    // Mongoose with Q wrapper
    svmp.mongoose = require('./mongoose')(svmp);

    // Model
    svmp.User = require('./model/user')(svmp.mongoose);
    svmp.VMSession = require('./model/vm-session')(svmp.mongoose);

    // used to lock out users who fail authentication too many times
    svmp.lockout = require('./lockout');
};

/**
 * Shut down. Closes DB connection and cleans up any temp config settings
 */
svmp.shutdown = function() {
    svmp.config.reset();

    if(svmp.mongoose.connection){
        svmp.mongoose.connection.close();
    }
};
