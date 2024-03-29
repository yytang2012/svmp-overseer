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
 *
 */

var nconf = require('nconf');
var yaml = require('js-yaml');
var revalidator = require('revalidator');
var schema = require('../config/schema');
var defaultConfig = require('./default-config');
var path = require('path');
var fs = require('fs');
var logger = require('./logger');

module.exports = function() {
    nconf.init();
    return nconf;
};

/**
 * Load Javascript configuration file.
 *
 * This code is adapted from the nconf project: https://github.com/flatiron/nconf
 *
 * @type {Configuration}
 */
nconf.init = function () {

    var configFile = path.join(__dirname, '/../config/config-yytang.yaml');
    if (!fs.existsSync(configFile)){
        logger.error('Config file does not exist: %s', configFile);
        process.exit(1);
    }

    logger.info('Loading config file: %s', configFile);

    nconf.file({
        file: configFile,
        format: {
            parse: yaml.safeLoad,
            stringify: yaml.safeDump
        }
    });
    nconf.defaults(defaultConfig);

    // Validate config against schema
    var validation = revalidator.validate(nconf.stores.file.store, schema);
    if (!validation.valid) {
        validation.errors.forEach(function (e) {
            logger.error(JSON.stringify(e, null, 2));
        });
        process.exit(1);
    } else {
        nconf.configTls();
    }
};

/**
 * Is the given key enabled (true or false?)
 * @param key
 * @returns {boolean}
 */
nconf.isEnabled = function (key) {
    return nconf.get(key) === true;
};

/**
 * Is the given key disabled?
 * @param key
 * @returns {boolean}
 */
nconf.isDisabled = function (key) {
    return nconf.get(key) === false;
};

/**
 * Use TLS certification authentication?
 * @returns {*}
 */
nconf.useTlsCertAuth = function () {
    return nconf.get('authentication_type') === 'certificate';
};

/**
 * Configure this TLS information.
 */
nconf.configTls = function () {
    if (this.isEnabled('enable_ssl')) {
        var privateKeyPath = nconf.get('private_key');
        var certFilePath = nconf.get('server_certificate');
        var passPhrase = nconf.get('private_key_pass');

        var options = {};

        try {
            var tls_key = fs.readFileSync(privateKeyPath);
        } catch (err) {
            logger.error("Could not open TLS private key '%s' (check config.private_key)", privateKeyPath);
            process.exit(1);
        }
        try {
            var tls_cert = fs.readFileSync(certFilePath);
        } catch (err) {
            logger.error("Could not open TLS certificate '%s' (check config.server_certificate)", certFilePath);
            process.exit(1);
        }
        options.type = 'tls';
        options.key = tls_key;
        options.passphrase = passPhrase;
        options.cert = tls_cert;
        options.honorCipherOrder = true;
        options.ciphers =
            "AES128-SHA:" +                    // TLS_RSA_WITH_AES_128_CBC_SHA
            "AES256-SHA:" +                    // TLS_RSA_WITH_AES_256_CBC_SHA
            "AES128-SHA256:" +                 // TLS_RSA_WITH_AES_128_CBC_SHA256
            "AES256-SHA256:" +                 // TLS_RSA_WITH_AES_256_CBC_SHA256
            "ECDHE-RSA-AES128-SHA:" +          // TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA
            "ECDHE-RSA-AES256-SHA:" +          // TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA
            "DHE-RSA-AES128-SHA:" +            // TLS_DHE_RSA_WITH_AES_128_CBC_SHA, should use at least 2048-bit DH
            "DHE-RSA-AES256-SHA:" +            // TLS_DHE_RSA_WITH_AES_256_CBC_SHA, should use at least 2048-bit DH
            "DHE-RSA-AES128-SHA256:" +         // TLS_DHE_RSA_WITH_AES_128_CBC_SHA256, should use at least 2048-bit DH
            "DHE-RSA-AES256-SHA256:" +         // TLS_DHE_RSA_WITH_AES_256_CBC_SHA256, should use at least 2048-bit DH
            "ECDHE-ECDSA-AES128-SHA256:" +     // TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA256, should use elliptic curve certificates
            "ECDHE-ECDSA-AES256-SHA384:" +     // TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA384, should use elliptic curve certificates
            "ECDHE-ECDSA-AES128-GCM-SHA256:" + // TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256, should use elliptic curve certificates
            "ECDHE-ECDSA-AES256-GCM-SHA384:" + // TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384, should use elliptic curve certificates
            "@STRENGTH";
        options.requestCert = false;

        if (nconf.useTlsCertAuth()) {
            var cacertPath = nconf.get('ca_cert');

            try {
                options.ca = [ fs.readFileSync(cacertPath) ];
            } catch (err) {
                logger.error("Could not open TLS ca cert file '%s' (check config.tls_ca_cert)", cacertPath);
                process.exit(1);
            }

            options.requestCert = true;
        }

        nconf.set('tls_options', options);
    }
};

nconf.getVideoResponse = function () {
    // Stringify parameters
    var ice = JSON.stringify(nconf.get('webrtc:ice_servers'));
    var video = JSON.stringify(nconf.get('webrtc:video'));
    var pc = JSON.stringify(nconf.get('webrtc:pc'));

    return { iceServers: ice, pcConstraints: pc, videoConstraints: video };
};
