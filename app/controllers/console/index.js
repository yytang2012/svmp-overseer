/*
 * Copyright 2014 The MITRE Corporation, All Rights Reserved.
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
 * author Dave Bryson
 *
 */
'use strict';

var
    passport = require('passport'),
    svmp = require('../../../lib/svmp'),
    lodash = require('lodash'),
    mail = require('../../../lib/mail');


/**
 * Get the error message from error object
 */
var getErrorMessage = function (err) {
    var message = '';
    if (err.code) {
        switch (err.code) {
            case 11000:
            case 11001:
                message = 'Username already exists';
                break;
            default:
                message = 'Something went wrong';
        }
    } else {
        for (var errName in err.errors) {
            if (err.errors[errName].message) message = err.errors[errName].message;
        }
    }
    return message;
};


/**
 * Module dependencies.
 */
exports.index = function (req, res) {
    res.render('index', {
        user: req.user || null
    });
};


exports.listSupportedDevices = function (req, res) {
    var o = lodash.map(svmp.config.get("new_vm_defaults:images"), function (v, k) {
        return {name: k, id: v}
    });
    res.status(200).jsonp(o);
};

/**
 * Signup
 */
exports.signup = function (req, res) {
    // For security measurement we remove the roles from the req.body object
    delete req.body.roles;

    if (!req.body.device_type || req.body.device_type.length === 0) {
        res.send(400);
    } else {
        // Init Variables
        var user = new svmp.User(req.body);
        // Then save the user
        user.save(function (err) {
            if (err) {
                return res.send(400, {
                    message: getErrorMessage(err)
                });
            } else {
                // Remove sensitive data before login
                user.password = undefined;
                user.salt = undefined;

                req.login(user, function (err) {
                    if (err) {
                        res.send(400, err);
                    } else {
                        mail.sendToAdmin();
                        res.jsonp(user);
                    }
                });
            }
        });
    }
};

/**
 * Signin after passport authentication
 */
exports.signin = function (req, res, next) {
    // check to see if this user account is currently locked
    var error = svmp.lockout.checkForLock(req.body.username);
    if (error) {
        res.json(401,{message: error});
        return;
    }

    passport.authenticate('local', function (err, user, info) {
        if (err) {
            res.send(400, info);
        } else if (!user) {
            // failed authentication
            res.send(401, info); // info is something like {message: "Invalid password"}
            svmp.lockout.failedAttempt(req.body.username);
        } else {
            // Remove sensitive data before login
            user.password = undefined;
            user.salt = undefined;

            req.login(user, function (err) {
                if (err) {
                    res.send(401, {message: error});
                    svmp.lockout.failedAttempt(req.body.username);
                } else {
                    res.jsonp(user);
                }
            });
        }
    })(req, res, next);
};

/**
 * Signout
 */
exports.signout = function (req, res) {
    req.logout();
    res.redirect('/');
};

/**
 * Change Password
 */
exports.changePassword = function (req, res, next) {
    // Init Variables
    var passwordDetails = req.body;
    var message = null;

    if (req.user) {
        svmp.User.findById(req.user.id, function (err, user) {
            if (!err && user) {
                if (user.authenticate(passwordDetails.currentPassword)) {
                    if (passwordDetails.newPassword === passwordDetails.verifyPassword) {
                        user.password = passwordDetails.newPassword;

                        user.save(function (err) {
                            if (err) {
                                return res.send(400, {
                                    message: getErrorMessage(err)
                                });
                            } else {
                                req.login(user, function (err) {
                                    if (err) {
                                        res.send(400, err);
                                    } else {
                                        res.send({
                                            message: 'Password changed successfully'
                                        });
                                    }
                                });
                            }
                        });
                    } else {
                        res.send(400, {
                            message: 'Passwords do not match'
                        });
                    }
                } else {
                    res.send(400, {
                        message: 'Current password is incorrect'
                    });
                }
            } else {
                res.send(400, {
                    message: 'User is not found'
                });
            }
        });
    } else {
        res.send(400, {
            message: 'User is not signed in'
        });
    }
};

exports.list = function (req, res) {
    var approvedFlag = req.query.approved === 'true';

    svmp.User.find({approved: approvedFlag})
        .sort('-created')
        .select('username email created approved roles device_type volume_id')
        .exec(function (err, results) {
            if (err) {
                return res.send(400, {
                    message: getErrorMessage(err) });
            } else {
                res.jsonp(results);
            }
        });
};


exports.read = function (req, res) {
    var userid = req.params.uid;
    var message = null;

    svmp.User.findById(userid, function (err, user) {
        if (err) {
            return res.send(400, {
                message: getErrorMessage(err)
            });
        } else {
            res.jsonp(user);
        }
    });
};

exports.update = function (req, res) {
    // Init Variables
    var userId = req.body._id;
    var email = req.query.email === 'true';
    var message = null;

    svmp.User.findById(userId, function (err, user) {
        if (err) {
            return res.send(400, {
                message: getErrorMessage(err)
            });
        } else {
            user = lodash.extend(user, req.body);
            user.save(function (err) {
                if (err) {
                    return res.send(400, {
                        message: getErrorMessage(err)
                    });
                } else {
                    if (email) {

                        mail.sendToUser(user.email);
                    }
                    res.jsonp(user);
                }
            });
        }
    });
};

exports.deleteUser = function (req, res) {
    var userId = req.params.uid;
    var message = null;
    svmp.User.remove({ _id: userId}, function (err, r) {
        if (err) {
            return res.send(400, {
                message: getErrorMessage(err)
            });
        } else {
            res.send(200);
        }
    });
};

/**
 * This creates a volume for a User AND updates the User's information
 * with the new volume data.   The logic to update the User's info on successful
 * volume creation is in the front-end logic - Why?  To handle the UI candy of volume
 * creation.
 *
 *
 * @param req
 * @param res
 */
exports.createVolume = function (req, res) {
    var user_id = req.body.uid;
    svmp.User.findById(user_id, function (err, user) {
        if (err) {
            res.logMessage = err;
            return res.send(400, {
                message: getErrorMessage(err)
            });
        } else {
            svmp.cloud.createVolumeForUser(user)
                .then(function (vol) {
                    // Send back info to browser to update UI
                    res.jsonp({user: user._id, volid: user.volume_id});
                },
                function (err) {
                    res.logMessage = err;
                    return res.send(400, {
                        message: getErrorMessage(err)
                    });
                });
        }
    });
};

// Only tested with AWS.  Format from AWS is:
// [{name:'', status: '', id: ''}
exports.listVolumes = function (req, res) {
    var results = [];
    svmp.cloud.getVolumes(function (err, r) {
        if (err) {
            svmp.logger.error("listVolumes failed:", err);
            res.json(500, {msg: "Problem listing volumes"});
        } else {
            res.json(200, r);
        }
    });
};

// Only tested with AWS.  Returned images format from AWS is:
// [{name:'', _id: ''}
exports.listImagesDevices = function (req, res) {
    var result = {images: [], devices: []};
    svmp.cloud.getImages(function (err, r) {
        if (err) {
            svmp.logger.error("listImages failed to get images:", err);
            res.json(500, {msg: "Error listing Cloud Images"});
        } else {
            var o = lodash.map(svmp.config.get("new_vm_defaults:images"), function (v, k) {
                    return {name: k, id: v}
            });
            result.images = r;
            result.devices= o;
            res.json(200, result);
        }
    });
};


// Post with Username.  Creates VM. Should update UI with VM ID and IP
/*exports.startVM = function(req,res) {
    if(un) {
        svmp.User.findUserWithPromise({username: un})
            .then(function (userObj) {
                // before we proceed, validate some user properties first
                if (svmp.config.get('new_vm_defaults:images')[userObj.device_type] === undefined)
                    throw new Error("User '" + userObj.username + "' has an unknown device type '" + userObj.device_type + "'");
                else if (userObj.volume_id === '')
                    throw new Error("User '" + userObj.username + "' does not have a Volume ID");
                return userObj;
            }).then(svmp.cloud.setUpUser)
            .then(function (userObj) {
                //userObj.vm_port = svmp.config.get('vm_port');
                // for some reason, setting a property on userObj doesn't stick - make a new object instead
                var obj = {
                    'vm_ip': userObj.vm_ip,
                    'vm_port': svmp.config.get('vm_port')
                };
                res.json(200, obj);
            }).catch(function (err) {
                svmp.logger.error("setUpVm failed:", err);
                res.send(500);
            }).done();
    }
}; */


/**
 * Require login routing middleware
 */
exports.requiresLogin = function (req, res, next) {
    if (!req.isAuthenticated()) {
        return res.send(401, {
            message: 'User is not logged in'
        });
    }

    next();
};

exports.requiresAdmin = function (req, res, next) {
    if (req.user.roles[0] === 'admin') {
        return next();
    } else {
        return res.send(403, {
            message: 'User is not authorized'
        });
    }
};





